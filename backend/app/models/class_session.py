from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base


class ClassSession(Base):
    __tablename__ = "class_sessions"
    __table_args__ = (UniqueConstraint("student_id", "schedule_id", "session_date", name="uq_session_student_sched_date"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    student_id: Mapped[int] = mapped_column(Integer, ForeignKey("students.id"), nullable=False, index=True)
    schedule_id: Mapped[str] = mapped_column(String, nullable=False)
    session_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    attended: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    confirmed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    confirmed_by: Mapped[str | None] = mapped_column(String, nullable=True)
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    package_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("packages.id"), nullable=True)
    classes_deducted: Mapped[float] = mapped_column(Float, default=1, nullable=False)
    revenue_amount: Mapped[float | None] = mapped_column(Float, nullable=True)
    revenue_month: Mapped[str | None] = mapped_column(String, nullable=True, index=True)  # "YYYY-MM"
