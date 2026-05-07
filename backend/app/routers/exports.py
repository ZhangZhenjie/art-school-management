"""Excel exports (admin only, spec §4.8)."""
from __future__ import annotations

from urllib.parse import quote

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import require_admin
from ..models.user import User
from ..services import exports as exp_svc
from ..services import revenue as rev_svc

router = APIRouter()

XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


def _xlsx_response(data: bytes, filename: str) -> Response:
    return Response(
        content=data,
        media_type=XLSX_MIME,
        headers={
            # RFC 5987 — encode non-ASCII filename so 中文 doesn't break Content-Disposition.
            "Content-Disposition": f"attachment; filename*=UTF-8''{quote(filename)}",
        },
    )


@router.get("/students")
def export_students(_: User = Depends(require_admin), db: Session = Depends(get_db)):
    data = exp_svc.export_students_packages(db)
    return _xlsx_response(data, "学生及配套.xlsx")


@router.get("/monthly-sessions")
def export_monthly_sessions(
    month: str | None = Query(None, description="YYYY-MM, default current month"),
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    m = month or rev_svc.current_month()
    rev_svc._validate_month(m)
    data = exp_svc.export_monthly_sessions(db, m)
    return _xlsx_response(data, f"{m}-课时消耗.xlsx")


@router.get("/revenue")
def export_revenue(
    month: str | None = Query(None, description="YYYY-MM, default current month"),
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    m = month or rev_svc.current_month()
    rev_svc._validate_month(m)
    data = exp_svc.export_revenue(db, m)
    return _xlsx_response(data, f"{m}-营收明细.xlsx")
