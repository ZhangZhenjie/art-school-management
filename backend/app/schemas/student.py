from datetime import date
from typing import Literal

from pydantic import BaseModel, ConfigDict

from .package import PackageOut


class StudentBase(BaseModel):
    name: str
    birthday: date | None = None
    email: str | None = None
    parent_name: str | None = None
    phone: str | None = None
    schedule_id: str | None = None


class StudentCreate(StudentBase):
    # First package fields (spec §4.2).
    purchased_classes: float
    gifted_classes: float = 0
    purchase_price: float
    start_date: date | None = None  # defaults to today server-side


class StudentUpdate(BaseModel):
    name: str | None = None
    birthday: date | None = None
    email: str | None = None
    parent_name: str | None = None
    phone: str | None = None
    schedule_id: str | None = None


class StudentDelete(BaseModel):
    revenue_month: str | None = None  # "YYYY-MM"
    note: str | None = None


StatusTag = Literal["arrears", "low_balance", "expiring_soon"]


class StudentOut(StudentBase):
    """List row — includes derived status + totals but no per-package detail."""
    model_config = ConfigDict(from_attributes=True)
    id: int
    is_active: bool
    total_remaining: float = 0
    package_count: int = 0
    status_tags: list[StatusTag] = []


class StudentDetailOut(StudentOut):
    """Detail view — includes the full package list."""
    packages: list[PackageOut] = []
