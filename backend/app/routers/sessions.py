"""Class-session management (spec §4.6)."""
from __future__ import annotations

from calendar import monthrange
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models.class_session import ClassSession
from ..models.schedule import Schedule
from ..models.student import Student
from ..models.user import User
from ..schemas.session import (
    AttendanceOut,
    ConfirmResponse,
    GenerateRequest,
    GenerateResponse,
    SessionConfirm,
    SessionUpdate,
    SessionWithStudent,
)
from ..services import sessions as sess_svc

router = APIRouter()


def _enrich(rows: list[ClassSession], db: Session) -> list[SessionWithStudent]:
    sids = {r.student_id for r in rows}
    schds = {r.schedule_id for r in rows}
    students = {s.id: s.name for s in db.query(Student).filter(Student.id.in_(sids or [-1])).all()}
    schedules = {s.id: s.name for s in db.query(Schedule).filter(Schedule.id.in_(schds or [""])).all()}
    return [
        SessionWithStudent(
            **{
                **{f: getattr(r, f) for f in (
                    "id", "student_id", "schedule_id", "session_date", "attended", "confirmed",
                    "confirmed_by", "confirmed_at", "package_id", "classes_deducted",
                    "revenue_amount", "revenue_month",
                )},
                "student_name": students.get(r.student_id, "?"),
                "schedule_name": schedules.get(r.schedule_id),
            }
        )
        for r in rows
    ]


@router.get("/sessions", response_model=list[SessionWithStudent])
def query_sessions(
    session_date: date | None = Query(None, alias="date"),
    student_id: int | None = None,
    schedule_id: str | None = None,
    month: str | None = Query(None, description="YYYY-MM"),
    confirmed: bool | None = None,
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(ClassSession)
    if session_date is not None:
        q = q.filter(ClassSession.session_date == session_date)
    if student_id is not None:
        q = q.filter(ClassSession.student_id == student_id)
    if schedule_id is not None:
        q = q.filter(ClassSession.schedule_id == schedule_id)
    if month:
        try:
            y, m = sess_svc.parse_month(month)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        last = monthrange(y, m)[1]
        q = q.filter(
            and_(
                ClassSession.session_date >= date(y, m, 1),
                ClassSession.session_date <= date(y, m, last),
            )
        )
    if confirmed is not None:
        q = q.filter(ClassSession.confirmed.is_(confirmed))

    rows = q.order_by(ClassSession.session_date, ClassSession.schedule_id, ClassSession.student_id).all()
    return _enrich(rows, db)


@router.post("/sessions/generate", response_model=GenerateResponse)
def generate_sessions(
    body: GenerateRequest | None = None,
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    body = body or GenerateRequest()
    try:
        y, m = sess_svc.parse_month(body.month)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    res = sess_svc.generate_for_month(db, y, m)
    db.commit()
    return GenerateResponse(
        month=f"{y}-{m:02d}",
        inserted=res.inserted,
        skipped=res.skipped,
        students_considered=res.students_considered,
    )


@router.put("/sessions/{session_id}", response_model=SessionWithStudent)
def update_session(
    session_id: int,
    body: SessionUpdate,
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sess = db.get(ClassSession, session_id)
    if sess is None:
        raise HTTPException(status_code=404, detail="Session not found")
    if sess.confirmed:
        raise HTTPException(
            status_code=409,
            detail="Confirmed session can only be modified via the audited package edit flow",
        )
    if body.attended is not None:
        sess.attended = body.attended
    db.commit()
    db.refresh(sess)
    return _enrich([sess], db)[0]


@router.post("/sessions/confirm", response_model=ConfirmResponse)
def confirm_sessions(
    body: SessionConfirm,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Apply consumption rules to one of: explicit ids, week, month, or schedule+date."""
    q = db.query(ClassSession).filter(ClassSession.confirmed.is_(False))

    if body.session_ids:
        q = q.filter(ClassSession.id.in_(body.session_ids))
    elif body.schedule_id and body.session_date:
        q = q.filter(
            ClassSession.schedule_id == body.schedule_id,
            ClassSession.session_date == body.session_date,
        )
    elif body.week_of:
        monday = body.week_of - timedelta(days=body.week_of.isoweekday() - 1)
        sunday = monday + timedelta(days=6)
        q = q.filter(and_(ClassSession.session_date >= monday, ClassSession.session_date <= sunday))
    elif body.month:
        try:
            y, m = sess_svc.parse_month(body.month)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        last = monthrange(y, m)[1]
        q = q.filter(
            and_(
                ClassSession.session_date >= date(y, m, 1),
                ClassSession.session_date <= date(y, m, last),
            )
        )
    else:
        raise HTTPException(
            status_code=400,
            detail="Provide one of: session_ids | schedule_id+session_date | week_of | month",
        )

    rows = q.all()
    res = sess_svc.confirm_sessions(
        db,
        rows,
        operator=user.username,
        revenue_month=body.revenue_month,
    )
    db.commit()
    return ConfirmResponse(
        confirmed=res.confirmed,
        skipped_already_confirmed=res.skipped_already_confirmed,
        classes_consumed=res.classes_consumed,
        revenue=res.revenue,
    )


@router.get("/attendance/{student_id}", response_model=AttendanceOut)
def attendance(
    student_id: int,
    year: int = Query(..., description="YYYY"),
    month: int | None = Query(None, ge=1, le=12),
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not db.query(Student.id).filter(Student.id == student_id).first():
        raise HTTPException(status_code=404, detail="Student not found")
    stats = sess_svc.attendance_for_student(db, student_id=student_id, year=year, month=month)
    return AttendanceOut(**stats.__dict__)
