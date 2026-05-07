"""Session generation, confirmation, attendance (spec §4.6)."""
from __future__ import annotations

from calendar import monthrange
from dataclasses import dataclass
from datetime import date, datetime
from typing import Iterable

import pytz
from sqlalchemy import and_
from sqlalchemy.orm import Session, selectinload

from ..config import settings
from ..models.class_session import ClassSession
from ..models.package import Package
from ..models.schedule import Schedule
from ..models.student import Student


# Spec §3.1: weekday encoding is 2..7 (Mon=2 ... Sun=7), so isoweekday()+1.
# Mon=1 in Python isoweekday → 2 in spec. Sun=7 in iso → 8 in spec... wait.
# Re-reading spec: weekday=2 means 周二 (Tuesday). In python isoweekday: Tue=2.
# So spec.weekday IS python's isoweekday. Mon-Sun = 1..7. Easy.
def _matches_weekday(d: date, schedule_weekday: int) -> bool:
    return d.isoweekday() == schedule_weekday


def _enumerate_month_dates(year: int, month: int, weekday: int) -> list[date]:
    last = monthrange(year, month)[1]
    return [
        date(year, month, day)
        for day in range(1, last + 1)
        if _matches_weekday(date(year, month, day), weekday)
    ]


def _now_tz() -> datetime:
    tz = pytz.timezone(settings.TIMEZONE or "UTC")
    return datetime.now(tz)


def parse_month(s: str | None) -> tuple[int, int]:
    """'YYYY-MM' → (year, month). None → current month in app TZ."""
    if not s:
        now = _now_tz()
        return now.year, now.month
    try:
        y, m = s.split("-")
        return int(y), int(m)
    except (ValueError, AttributeError):
        raise ValueError(f"Invalid month format: {s!r}, expected YYYY-MM")


@dataclass
class GenerateResult:
    inserted: int
    skipped: int
    students_considered: int


def generate_for_month(db: Session, year: int, month: int) -> GenerateResult:
    """Insert (attended=1, confirmed=0) sessions for every active student × matching dates.

    Skips students whose schedule_id is NULL or '1O' (offline private — no auto-gen).
    Already-existing rows (uniqueness on student/schedule/date) are skipped silently.
    """
    students = (
        db.query(Student)
        .filter(Student.is_active.is_(True))
        .filter(Student.schedule_id.is_not(None))
        .filter(Student.schedule_id != "1O")
        .all()
    )

    schedules = {s.id: s for s in db.query(Schedule).all()}

    # Existing keys to skip duplicate inserts.
    existing = {
        (sid, scid, d)
        for sid, scid, d in db.query(
            ClassSession.student_id, ClassSession.schedule_id, ClassSession.session_date
        )
        .filter(ClassSession.session_date >= date(year, month, 1))
        .filter(
            ClassSession.session_date
            < date(year + (1 if month == 12 else 0), 1 if month == 12 else month + 1, 1)
        )
        .all()
    }

    inserted = 0
    skipped = 0

    for st in students:
        sched = schedules.get(st.schedule_id)
        if sched is None:
            continue
        for d in _enumerate_month_dates(year, month, sched.weekday):
            key = (st.id, sched.id, d)
            if key in existing:
                skipped += 1
                continue
            db.add(
                ClassSession(
                    student_id=st.id,
                    schedule_id=sched.id,
                    session_date=d,
                    attended=True,
                    confirmed=False,
                )
            )
            inserted += 1
    if inserted:
        db.flush()
    return GenerateResult(inserted=inserted, skipped=skipped, students_considered=len(students))


def _consume_one_class(student: Student) -> Package | None:
    """Pick the package that should bear one class consumption.

    Prefer oldest (start_date, id) with remaining > 0. If none have positive remaining,
    fall back to the oldest package overall (which goes deeper into negative — arrears).
    Returns None only if the student has no packages at all.
    """
    if not student.packages:
        return None
    sorted_pkgs = sorted(student.packages, key=lambda p: (p.start_date, p.id))
    for p in sorted_pkgs:
        if p.remaining_classes > 0:
            return p
    return sorted_pkgs[0]


@dataclass
class ConfirmResult:
    confirmed: int
    skipped_already_confirmed: int
    classes_consumed: float
    revenue: float


def confirm_sessions(
    db: Session,
    sessions: Iterable[ClassSession],
    *,
    operator: str,
    revenue_month: str | None = None,
) -> ConfirmResult:
    """Apply spec §4.6 consumption rules to a batch of sessions.

    For each unconfirmed session:
      - attended=True  → consume 1 class from the chosen package, log revenue_amount.
      - attended=False → confirmed only, no consumption, revenue_amount=0.
    Confirmed=True rows are left alone (idempotent re-call).
    """
    rev_month = revenue_month or _now_tz().strftime("%Y-%m")
    confirmed_now = 0
    skipped = 0
    consumed = 0.0
    revenue = 0.0
    now = _now_tz().replace(tzinfo=None)

    # Pre-fetch students + packages to avoid N+1.
    student_ids = {s.student_id for s in sessions}
    students_by_id = {
        st.id: st
        for st in db.query(Student)
        .options(selectinload(Student.packages))
        .filter(Student.id.in_(student_ids or [-1]))
        .all()
    }

    for sess in sessions:
        if sess.confirmed:
            skipped += 1
            continue
        student = students_by_id.get(sess.student_id)
        if student is None:
            skipped += 1
            continue
        if sess.attended:
            pkg = _consume_one_class(student)
            if pkg is None:
                # No packages → consume nothing but still confirm.
                sess.classes_deducted = 0
                sess.revenue_amount = 0.0
            else:
                pkg.remaining_classes -= 1
                pkg.is_negative = pkg.remaining_classes < 0
                sess.package_id = pkg.id
                sess.classes_deducted = 1
                sess.revenue_amount = round(1 * pkg.unit_price, 2)
                consumed += 1
                revenue += sess.revenue_amount
        else:
            sess.classes_deducted = 0
            sess.revenue_amount = 0.0

        sess.confirmed = True
        sess.confirmed_by = operator
        sess.confirmed_at = now
        sess.revenue_month = rev_month
        confirmed_now += 1

    return ConfirmResult(
        confirmed=confirmed_now,
        skipped_already_confirmed=skipped,
        classes_consumed=consumed,
        revenue=round(revenue, 2),
    )


def week_bounds(any_day: date) -> tuple[date, date]:
    """Mon..Sun containing `any_day`."""
    from datetime import timedelta
    monday = any_day - timedelta(days=any_day.isoweekday() - 1)
    sunday = monday + timedelta(days=6)
    return monday, sunday


@dataclass
class AttendanceStats:
    student_id: int
    period: str  # "YYYY" or "YYYY-MM"
    expected: int
    attended: int
    absent: int
    unconfirmed: int
    attendance_rate: float | None  # attended / (attended+absent), None if denominator 0


def attendance_for_student(
    db: Session, *, student_id: int, year: int, month: int | None = None
) -> AttendanceStats:
    """spec §4.6 attendance rate. Period is whole year if month is None.

    expected = total session rows in window (regardless of confirmed status)
    attended = confirmed=true AND attended=true
    absent   = confirmed=true AND attended=false
    rate     = attended / (attended + absent)  — only counts confirmed sessions
    """
    if month is None:
        start = date(year, 1, 1)
        end = date(year, 12, 31)
        period = f"{year}"
    else:
        start = date(year, month, 1)
        last = monthrange(year, month)[1]
        end = date(year, month, last)
        period = f"{year}-{month:02d}"

    rows = (
        db.query(ClassSession)
        .filter(ClassSession.student_id == student_id)
        .filter(and_(ClassSession.session_date >= start, ClassSession.session_date <= end))
        .all()
    )

    attended = sum(1 for r in rows if r.confirmed and r.attended)
    absent = sum(1 for r in rows if r.confirmed and not r.attended)
    unconfirmed = sum(1 for r in rows if not r.confirmed)
    expected = len(rows)
    denom = attended + absent
    rate = round(attended / denom, 4) if denom else None
    return AttendanceStats(
        student_id=student_id,
        period=period,
        expected=expected,
        attended=attended,
        absent=absent,
        unconfirmed=unconfirmed,
        attendance_rate=rate,
    )
