from datetime import date, datetime

from pydantic import BaseModel, ConfigDict


class PackageCreate(BaseModel):
    purchased_classes: float
    gifted_classes: float = 0
    purchase_price: float
    start_date: date | None = None
    revenue_month: str | None = None  # for arrears deduction, admin override


class PackageUpdate(BaseModel):
    remaining_classes: float | None = None
    unit_price: float | None = None
    end_date: date | None = None
    note: str  # required for any field change


class PackageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    student_id: int
    purchased_classes: float
    gifted_classes: float
    total_classes: float
    unit_price: float
    purchase_price: float
    remaining_classes: float
    start_date: date
    end_date: date
    is_negative: bool
    created_at: datetime
