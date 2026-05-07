"""Revenue summary + details (admin only, spec §4.7)."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import require_admin
from ..models.user import User
from ..schemas.revenue import (
    RevenueDetailRow,
    RevenueSummary,
    StudentBreakdownOut,
    TypeBreakdownOut,
)
from ..services import revenue as rev_svc

router = APIRouter()


def _params(month: str | None, from_m: str | None, to_m: str | None):
    if month and (from_m or to_m):
        raise HTTPException(status_code=400, detail="Use either month OR from/to — not both")
    return month, from_m, to_m


@router.get("/summary", response_model=RevenueSummary)
def summary(
    month: str | None = Query(None, description="YYYY-MM"),
    from_m: str | None = Query(None, alias="from", description="YYYY-MM (inclusive)"),
    to_m: str | None = Query(None, alias="to", description="YYYY-MM (inclusive)"),
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    month, from_m, to_m = _params(month, from_m, to_m)
    try:
        s = rev_svc.summary(db, month=month, from_m=from_m, to_m=to_m)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return RevenueSummary(
        period=s.period,
        total_amount=s.total_amount,
        total_classes=s.total_classes,
        sessions_amount=s.sessions_amount,
        adjustments_amount=s.adjustments_amount,
        by_student=[StudentBreakdownOut(**b.__dict__) for b in s.by_student],
        by_schedule_type=[TypeBreakdownOut(**b.__dict__) for b in s.by_schedule_type],
    )


@router.get("/details", response_model=list[RevenueDetailRow])
def details(
    month: str | None = Query(None, description="YYYY-MM"),
    from_m: str | None = Query(None, alias="from"),
    to_m: str | None = Query(None, alias="to"),
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    month, from_m, to_m = _params(month, from_m, to_m)
    try:
        rows = rev_svc.details(db, month=month, from_m=from_m, to_m=to_m)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return [RevenueDetailRow(**r.__dict__) for r in rows]
