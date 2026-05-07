"""Package business logic — create, merge, arrears deduction (spec §4.2 / §4.3)."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime

import pytz
from dateutil.relativedelta import relativedelta
from sqlalchemy.orm import Session

from ..config import settings
from ..models.package import Package
from ..models.revenue_adjustment import RevenueAdjustment
from ..models.student import Student


def today_local() -> date:
    tz = pytz.timezone(settings.TIMEZONE or "UTC")
    return datetime.now(tz).date()


def current_revenue_month() -> str:
    return today_local().strftime("%Y-%m")


def compute_end_date(purchased_classes: float, start: date) -> date:
    """spec §3.3: <48 classes → +4 months, ≥48 → +16 months."""
    months = 4 if purchased_classes < 48 else 16
    return start + relativedelta(months=months)


def _round_price(x: float) -> float:
    """Drop float fuzz so unit-price equality matching is stable."""
    return round(x, 4)


@dataclass
class PackageQuote:
    """Computed values for a prospective new package — used for both create and merge paths."""
    purchased_classes: float
    gifted_classes: float
    total_classes: float
    unit_price: float
    purchase_price: float
    start_date: date
    end_date: date


def quote(
    *,
    purchased_classes: float,
    gifted_classes: float,
    purchase_price: float,
    start_date: date | None,
) -> PackageQuote:
    """Pure helper: derive total/unit_price/end_date for a new package."""
    if purchased_classes <= 0:
        raise ValueError("purchased_classes must be > 0")
    if gifted_classes < 0:
        raise ValueError("gifted_classes cannot be negative")
    total = purchased_classes + gifted_classes
    if total <= 0:
        raise ValueError("total_classes must be > 0")
    unit_price = _round_price(purchase_price / total)
    sd = start_date or today_local()
    return PackageQuote(
        purchased_classes=purchased_classes,
        gifted_classes=gifted_classes,
        total_classes=total,
        unit_price=unit_price,
        purchase_price=purchase_price,
        start_date=sd,
        end_date=compute_end_date(purchased_classes, sd),
    )


def create_first_package(db: Session, student_id: int, q: PackageQuote) -> Package:
    """For a brand-new student. No arrears, no merge — just insert."""
    pkg = Package(
        student_id=student_id,
        purchased_classes=q.purchased_classes,
        gifted_classes=q.gifted_classes,
        total_classes=q.total_classes,
        unit_price=q.unit_price,
        purchase_price=q.purchase_price,
        remaining_classes=q.total_classes,
        start_date=q.start_date,
        end_date=q.end_date,
        is_negative=False,
    )
    db.add(pkg)
    db.flush()
    return pkg


@dataclass
class AddPackageResult:
    package: Package           # the package row that holds the new classes (merged or freshly created)
    merged_into_existing: bool
    arrears_deducted: float    # classes deducted from new package to cover prior negative balance
    arrears_amount: float      # revenue logged for the deduction
    revenue_adjustment_id: int | None


def add_package(
    db: Session,
    *,
    student: Student,
    q: PackageQuote,
    operator: str,
    revenue_month: str | None = None,
) -> AddPackageResult:
    """Add a new package to an existing student, applying merge + arrears rules (spec §4.3).

    Merge rule: within the same student, if any existing package shares unit_price with the
    new quote, merge: bump remaining by new total_classes and extend end_date to the later one.
    (Spec mentions "schedule_type 相同" but a student has a single current_schedule, so the
    course-type axis is constant within a student's package set; unit_price is the discriminator.)

    Arrears rule: if the student has any package with remaining < 0, deduct that magnitude
    from the new (merged or fresh) package's remaining and emit a revenue_adjustments row
    (reason="deduct_arrears", amount = arrears * new unit_price).
    """
    # Total existing arrears across all packages.
    arrears = sum(-p.remaining_classes for p in student.packages if p.remaining_classes < 0)

    # Try merge against any existing package by unit_price.
    merge_target: Package | None = next(
        (p for p in student.packages if _round_price(p.unit_price) == q.unit_price),
        None,
    )

    if merge_target is not None:
        merge_target.remaining_classes += q.total_classes
        merge_target.purchased_classes += q.purchased_classes
        merge_target.gifted_classes += q.gifted_classes
        merge_target.total_classes += q.total_classes
        merge_target.purchase_price += q.purchase_price
        if q.end_date > merge_target.end_date:
            merge_target.end_date = q.end_date
        merge_target.is_negative = merge_target.remaining_classes < 0
        target = merge_target
        merged = True
    else:
        target = Package(
            student_id=student.id,
            purchased_classes=q.purchased_classes,
            gifted_classes=q.gifted_classes,
            total_classes=q.total_classes,
            unit_price=q.unit_price,
            purchase_price=q.purchase_price,
            remaining_classes=q.total_classes,
            start_date=q.start_date,
            end_date=q.end_date,
            is_negative=False,
        )
        db.add(target)
        db.flush()
        merged = False

    arrears_amount = 0.0
    adj_id: int | None = None
    if arrears > 0:
        # Settle arrears by zeroing the negative packages and pulling from the new one.
        for p in student.packages:
            if p.remaining_classes < 0:
                p.remaining_classes = 0
                p.is_negative = False
        target.remaining_classes -= arrears
        arrears_amount = round(arrears * q.unit_price, 2)
        adj = RevenueAdjustment(
            student_id=student.id,
            student_name=student.name,
            reason="deduct_arrears",
            amount=arrears_amount,
            classes_count=arrears,
            unit_price=q.unit_price,
            revenue_month=revenue_month or current_revenue_month(),
            operated_by=operator,
            note=f"abate arrears via new package {target.id}",
        )
        db.add(adj)
        db.flush()
        adj_id = adj.id

    target.is_negative = target.remaining_classes < 0
    return AddPackageResult(
        package=target,
        merged_into_existing=merged,
        arrears_deducted=arrears,
        arrears_amount=arrears_amount,
        revenue_adjustment_id=adj_id,
    )


def forfeit_remaining_on_delete(
    db: Session,
    *,
    student: Student,
    operator: str,
    revenue_month: str | None = None,
    note: str | None = None,
) -> RevenueAdjustment | None:
    """Spec §4.4: when soft-deleting a student, write the unconsumed remaining to revenue.

    Sums remaining across all packages where remaining > 0; weights by per-package unit_price.
    Negative packages don't contribute (those are losses, not earned revenue).
    """
    total_classes = 0.0
    total_amount = 0.0
    for p in student.packages:
        if p.remaining_classes > 0:
            total_classes += p.remaining_classes
            total_amount += p.remaining_classes * p.unit_price
    if total_classes <= 0:
        return None
    avg_unit_price = round(total_amount / total_classes, 4) if total_classes else 0.0
    adj = RevenueAdjustment(
        student_id=student.id,
        student_name=student.name,
        reason="student_deleted",
        amount=round(total_amount, 2),
        classes_count=total_classes,
        unit_price=avg_unit_price,
        revenue_month=revenue_month or current_revenue_month(),
        operated_by=operator,
        note=note,
    )
    db.add(adj)
    db.flush()
    return adj
