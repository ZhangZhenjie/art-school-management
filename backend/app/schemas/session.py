from datetime import date, datetime

from pydantic import BaseModel, ConfigDict


class SessionUpdate(BaseModel):
    attended: bool | None = None


class SessionConfirm(BaseModel):
    """At least one of session_ids / schedule_id+date / week_of / month must be set.

    Combination rules:
      - session_ids: confirm exactly these (overrides other filters)
      - schedule_id + session_date: confirm that one class on that day
      - week_of: confirm all unconfirmed sessions Mon..Sun containing this date
      - month "YYYY-MM": confirm all unconfirmed sessions in that month
    """
    session_ids: list[int] | None = None
    schedule_id: str | None = None
    session_date: date | None = None
    week_of: date | None = None
    month: str | None = None
    revenue_month: str | None = None


class GenerateRequest(BaseModel):
    month: str | None = None  # "YYYY-MM" — defaults to current month


class GenerateResponse(BaseModel):
    month: str
    inserted: int
    skipped: int
    students_considered: int


class SessionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    student_id: int
    schedule_id: str
    session_date: date
    attended: bool
    confirmed: bool
    confirmed_by: str | None
    confirmed_at: datetime | None
    package_id: int | None
    classes_deducted: float
    revenue_amount: float | None
    revenue_month: str | None


class SessionWithStudent(SessionOut):
    """Session row enriched with student name + schedule name (for list views)."""
    student_name: str
    schedule_name: str | None


class ConfirmResponse(BaseModel):
    confirmed: int
    skipped_already_confirmed: int
    classes_consumed: float
    revenue: float


class AttendanceOut(BaseModel):
    student_id: int
    period: str
    expected: int
    attended: int
    absent: int
    unconfirmed: int
    attendance_rate: float | None
