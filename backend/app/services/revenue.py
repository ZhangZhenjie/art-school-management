"""Revenue aggregation across class_sessions + revenue_adjustments (spec §4.7)."""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime

import pytz
from sqlalchemy.orm import Session

from ..config import settings
from ..models.class_session import ClassSession
from ..models.revenue_adjustment import RevenueAdjustment
from ..models.schedule import Schedule
from ..models.student import Student


def current_month() -> str:
    tz = pytz.timezone(settings.TIMEZONE or "UTC")
    return datetime.now(tz).strftime("%Y-%m")


def _validate_month(s: str) -> str:
    try:
        y, m = s.split("-")
        int(y)
        mi = int(m)
        if not (1 <= mi <= 12) or len(m) != 2:
            raise ValueError
    except ValueError:
        raise ValueError(f"Invalid month {s!r}, expected 'YYYY-MM'")
    return s


def _month_filter(query, col, month: str | None, from_m: str | None, to_m: str | None):
    if month:
        return query.filter(col == _validate_month(month))
    if from_m and to_m:
        return query.filter(col >= _validate_month(from_m), col <= _validate_month(to_m))
    if from_m:
        return query.filter(col >= _validate_month(from_m))
    if to_m:
        return query.filter(col <= _validate_month(to_m))
    return query


@dataclass
class StudentBreakdown:
    student_id: int | None
    student_name: str
    classes: float
    amount: float


@dataclass
class TypeBreakdown:
    schedule_type: str  # schedule.name e.g. "兴趣班"
    classes: float
    amount: float


@dataclass
class RevenueSummary:
    period: str
    total_amount: float
    total_classes: float
    sessions_amount: float
    adjustments_amount: float
    by_student: list[StudentBreakdown] = field(default_factory=list)
    by_schedule_type: list[TypeBreakdown] = field(default_factory=list)


@dataclass
class RevenueDetailRow:
    student_id: int | None
    student_name: str
    schedule_id: str | None
    schedule_type: str | None
    classes: float
    unit_price: float | None
    amount: float
    source: str  # "session" | "adjustment"
    revenue_month: str
    note: str | None
    session_date: str | None
    adjustment_reason: str | None


def summary(
    db: Session,
    *,
    month: str | None = None,
    from_m: str | None = None,
    to_m: str | None = None,
) -> RevenueSummary:
    if not (month or from_m or to_m):
        month = current_month()

    sessions_q = (
        db.query(ClassSession)
        .filter(ClassSession.confirmed.is_(True))
        .filter(ClassSession.revenue_month.is_not(None))
    )
    sessions_q = _month_filter(sessions_q, ClassSession.revenue_month, month, from_m, to_m)
    sessions = sessions_q.all()

    adj_q = db.query(RevenueAdjustment)
    adj_q = _month_filter(adj_q, RevenueAdjustment.revenue_month, month, from_m, to_m)
    adjustments = adj_q.all()

    students = {s.id: s.name for s in db.query(Student).all()}
    schedules = {s.id: s.name for s in db.query(Schedule).all()}

    sessions_amount = round(sum(s.revenue_amount or 0.0 for s in sessions), 2)
    adjustments_amount = round(sum(a.amount for a in adjustments), 2)

    sessions_classes = round(sum(s.classes_deducted or 0 for s in sessions), 2)
    adjustments_classes = round(sum(a.classes_count for a in adjustments), 2)

    student_acc: dict[int | None, StudentBreakdown] = {}
    for s in sessions:
        key = s.student_id
        name = students.get(s.student_id, "(unknown)")
        b = student_acc.setdefault(key, StudentBreakdown(student_id=key, student_name=name, classes=0, amount=0))
        b.classes += s.classes_deducted or 0
        b.amount += s.revenue_amount or 0
    for a in adjustments:
        key = a.student_id
        name = a.student_name
        b = student_acc.setdefault(key, StudentBreakdown(student_id=key, student_name=name, classes=0, amount=0))
        b.classes += a.classes_count
        b.amount += a.amount
    by_student = sorted(student_acc.values(), key=lambda x: -x.amount)
    for b in by_student:
        b.amount = round(b.amount, 2)
        b.classes = round(b.classes, 2)

    type_acc: dict[str, TypeBreakdown] = {}
    for s in sessions:
        type_name = schedules.get(s.schedule_id, "(unknown)")
        b = type_acc.setdefault(type_name, TypeBreakdown(schedule_type=type_name, classes=0, amount=0))
        b.classes += s.classes_deducted or 0
        b.amount += s.revenue_amount or 0
    by_type = sorted(type_acc.values(), key=lambda x: -x.amount)
    for b in by_type:
        b.amount = round(b.amount, 2)
        b.classes = round(b.classes, 2)

    if month:
        period = month
    elif from_m and to_m:
        period = f"{from_m}..{to_m}"
    elif from_m:
        period = f"{from_m}.."
    else:
        period = f"..{to_m}"

    return RevenueSummary(
        period=period,
        total_amount=round(sessions_amount + adjustments_amount, 2),
        total_classes=round(sessions_classes + adjustments_classes, 2),
        sessions_amount=sessions_amount,
        adjustments_amount=adjustments_amount,
        by_student=by_student,
        by_schedule_type=by_type,
    )


def details(
    db: Session,
    *,
    month: str | None = None,
    from_m: str | None = None,
    to_m: str | None = None,
) -> list[RevenueDetailRow]:
    if not (month or from_m or to_m):
        month = current_month()

    students = {s.id: s.name for s in db.query(Student).all()}
    schedules = {s.id: s.name for s in db.query(Schedule).all()}

    sessions_q = (
        db.query(ClassSession)
        .filter(ClassSession.confirmed.is_(True))
        .filter(ClassSession.revenue_month.is_not(None))
    )
    sessions_q = _month_filter(sessions_q, ClassSession.revenue_month, month, from_m, to_m)

    rows: list[RevenueDetailRow] = []
    for s in sessions_q.all():
        # Absent confirmed sessions earn nothing — skip from details (still count in attendance).
        if (s.revenue_amount or 0) == 0 and (s.classes_deducted or 0) == 0:
            continue
        unit = (s.revenue_amount / s.classes_deducted) if (s.classes_deducted or 0) else None
        rows.append(
            RevenueDetailRow(
                student_id=s.student_id,
                student_name=students.get(s.student_id, "(unknown)"),
                schedule_id=s.schedule_id,
                schedule_type=schedules.get(s.schedule_id),
                classes=s.classes_deducted or 0,
                unit_price=round(unit, 4) if unit is not None else None,
                amount=round(s.revenue_amount or 0, 2),
                source="session",
                revenue_month=s.revenue_month or "",
                note=None,
                session_date=s.session_date.isoformat() if s.session_date else None,
                adjustment_reason=None,
            )
        )

    adj_q = db.query(RevenueAdjustment)
    adj_q = _month_filter(adj_q, RevenueAdjustment.revenue_month, month, from_m, to_m)
    for a in adj_q.all():
        rows.append(
            RevenueDetailRow(
                student_id=a.student_id,
                student_name=a.student_name,
                schedule_id=None,
                schedule_type=None,
                classes=a.classes_count,
                unit_price=a.unit_price,
                amount=round(a.amount, 2),
                source="adjustment",
                revenue_month=a.revenue_month,
                note=a.note,
                session_date=None,
                adjustment_reason=a.reason,
            )
        )

    rows.sort(key=lambda r: (r.revenue_month, r.session_date or "", r.student_name))
    return rows
