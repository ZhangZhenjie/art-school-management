"""Students + packages CRUD (spec §4.2 / §4.3 / §4.4 / §4.5)."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..deps import get_current_user
from ..models.audit_log import AuditLog
from ..models.package import Package
from ..models.student import Student
from ..models.user import User
from ..schemas.audit import AuditLogOut
from ..schemas.package import PackageCreate, PackageOut, PackageUpdate
from ..schemas.student import (
    StudentCreate,
    StudentDelete,
    StudentDetailOut,
    StudentOut,
    StudentUpdate,
)
from ..services import packages as pkg_svc
from ..services import students as stu_svc
from ..services.audit import log_change

router = APIRouter()


def _student_or_404(db: Session, student_id: int) -> Student:
    s = (
        db.query(Student)
        .options(selectinload(Student.packages))
        .filter(Student.id == student_id)
        .first()
    )
    if not s:
        raise HTTPException(status_code=404, detail="Student not found")
    return s


def _serialize_list(s: Student) -> StudentOut:
    return StudentOut(
        id=s.id,
        name=s.name,
        birthday=s.birthday,
        email=s.email,
        parent_name=s.parent_name,
        phone=s.phone,
        schedule_id=s.schedule_id,
        is_active=s.is_active,
        total_remaining=stu_svc.total_remaining(s.packages),
        package_count=len(s.packages),
        status_tags=stu_svc.status_tags(s.packages),
    )


def _serialize_detail(s: Student) -> StudentDetailOut:
    base = _serialize_list(s).model_dump()
    return StudentDetailOut(
        **base,
        packages=[PackageOut.model_validate(p) for p in s.packages],
    )


@router.get("", response_model=list[StudentOut])
def list_students(
    q: str | None = Query(None, description="match name / parent_name / phone / email"),
    schedule_id: str | None = None,
    status_tag: str | None = Query(None, description="arrears | low_balance | expiring_soon"),
    include_inactive: bool = False,
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(Student).options(selectinload(Student.packages))
    if not include_inactive:
        query = query.filter(Student.is_active.is_(True))
    if schedule_id:
        query = query.filter(Student.schedule_id == schedule_id)
    if q:
        like = f"%{q}%"
        query = query.filter(
            or_(
                Student.name.ilike(like),
                Student.parent_name.ilike(like),
                Student.phone.ilike(like),
                Student.email.ilike(like),
            )
        )
    rows = query.order_by(Student.name).all()
    out = [_serialize_list(s) for s in rows]
    if status_tag:
        out = [r for r in out if status_tag in r.status_tags]
    return out


@router.post("", response_model=StudentDetailOut, status_code=status.HTTP_201_CREATED)
def create_student(
    body: StudentCreate,
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        quote = pkg_svc.quote(
            purchased_classes=body.purchased_classes,
            gifted_classes=body.gifted_classes,
            purchase_price=body.purchase_price,
            start_date=body.start_date,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    s = Student(
        name=body.name,
        birthday=body.birthday,
        email=body.email,
        parent_name=body.parent_name,
        phone=body.phone,
        schedule_id=body.schedule_id,
        is_active=True,
    )
    db.add(s)
    db.flush()
    pkg_svc.create_first_package(db, s.id, quote)
    db.commit()
    db.refresh(s)
    return _serialize_detail(s)


@router.get("/{student_id}", response_model=StudentDetailOut)
def get_student(student_id: int, _: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _serialize_detail(_student_or_404(db, student_id))


@router.put("/{student_id}", response_model=StudentDetailOut)
def update_student(
    student_id: int,
    body: StudentUpdate,
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    s = _student_or_404(db, student_id)
    payload = body.model_dump(exclude_unset=True)
    for k, v in payload.items():
        setattr(s, k, v)
    db.commit()
    db.refresh(s)
    return _serialize_detail(s)


@router.delete("/{student_id}", response_model=StudentDetailOut)
def delete_student(
    student_id: int,
    body: StudentDelete | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    s = _student_or_404(db, student_id)
    if not s.is_active:
        raise HTTPException(status_code=409, detail="Student already inactive")
    body = body or StudentDelete()
    pkg_svc.forfeit_remaining_on_delete(
        db,
        student=s,
        operator=user.username,
        revenue_month=body.revenue_month,
        note=body.note,
    )
    log_change(
        db,
        operator=user.username,
        entity_type="student",
        entity_id=s.id,
        field_name="is_active",
        old_value="1",
        new_value="0",
        note=body.note,
    )
    s.is_active = False
    db.commit()
    db.refresh(s)
    return _serialize_detail(s)


@router.get("/{student_id}/packages", response_model=list[PackageOut])
def list_packages(student_id: int, _: User = Depends(get_current_user), db: Session = Depends(get_db)):
    s = _student_or_404(db, student_id)
    # Older packages first — matches consumption order (spec §八.1).
    return sorted(s.packages, key=lambda p: (p.start_date, p.id))


@router.post("/{student_id}/packages", response_model=StudentDetailOut, status_code=status.HTTP_201_CREATED)
def add_package(
    student_id: int,
    body: PackageCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    s = _student_or_404(db, student_id)
    if not s.is_active:
        raise HTTPException(status_code=409, detail="Student is inactive")
    try:
        quote = pkg_svc.quote(
            purchased_classes=body.purchased_classes,
            gifted_classes=body.gifted_classes,
            purchase_price=body.purchase_price,
            start_date=body.start_date,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    pkg_svc.add_package(
        db,
        student=s,
        q=quote,
        operator=user.username,
        revenue_month=body.revenue_month,
    )
    db.commit()
    db.refresh(s)
    return _serialize_detail(s)


# Fields whose mutation requires an audit-log note (spec §4.5).
_AUDITED_PKG_FIELDS = {"remaining_classes", "unit_price", "end_date"}


@router.put("/{student_id}/packages/{pkg_id}", response_model=PackageOut)
def update_package(
    student_id: int,
    pkg_id: int,
    body: PackageUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    pkg = (
        db.query(Package)
        .filter(Package.id == pkg_id, Package.student_id == student_id)
        .first()
    )
    if not pkg:
        raise HTTPException(status_code=404, detail="Package not found")

    payload = body.model_dump(exclude_unset=True)
    note = payload.pop("note", None)
    if not payload:
        raise HTTPException(status_code=400, detail="No fields to update")
    if any(f in _AUDITED_PKG_FIELDS for f in payload) and not note:
        raise HTTPException(status_code=400, detail="Note required when modifying audited fields")

    for field, new in payload.items():
        old = getattr(pkg, field)
        if old == new:
            continue
        setattr(pkg, field, new)
        if field in _AUDITED_PKG_FIELDS:
            log_change(
                db,
                operator=user.username,
                entity_type="package",
                entity_id=pkg.id,
                field_name=field,
                old_value=str(old),
                new_value=str(new),
                note=note,
            )

    pkg.is_negative = pkg.remaining_classes < 0
    db.commit()
    db.refresh(pkg)
    return pkg


@router.get("/{student_id}/audit-logs", response_model=list[AuditLogOut])
def list_audit_logs(student_id: int, _: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Audit entries for the student itself + any of its packages."""
    s = _student_or_404(db, student_id)
    pkg_ids = [p.id for p in s.packages]
    return (
        db.query(AuditLog)
        .filter(
            or_(
                (AuditLog.entity_type == "student") & (AuditLog.entity_id == s.id),
                (AuditLog.entity_type == "package") & (AuditLog.entity_id.in_(pkg_ids or [-1])),
            )
        )
        .order_by(AuditLog.operated_at.desc())
        .all()
    )
