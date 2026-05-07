from pydantic import BaseModel


class StudentBreakdownOut(BaseModel):
    student_id: int | None
    student_name: str
    classes: float
    amount: float


class TypeBreakdownOut(BaseModel):
    schedule_type: str
    classes: float
    amount: float


class RevenueSummary(BaseModel):
    period: str
    total_amount: float
    total_classes: float
    sessions_amount: float
    adjustments_amount: float
    by_student: list[StudentBreakdownOut] = []
    by_schedule_type: list[TypeBreakdownOut] = []


class RevenueDetailRow(BaseModel):
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
