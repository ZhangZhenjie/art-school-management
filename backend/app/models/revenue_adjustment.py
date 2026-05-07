from datetime import datetime

from sqlalchemy import DateTime, Float, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base


class RevenueAdjustment(Base):
    __tablename__ = "revenue_adjustments"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    student_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    student_name: Mapped[str] = mapped_column(String, nullable=False)
    reason: Mapped[str] = mapped_column(String, nullable=False)  # "student_deleted" | "deduct_arrears"
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    classes_count: Mapped[float] = mapped_column(Float, nullable=False)
    unit_price: Mapped[float] = mapped_column(Float, nullable=False)
    revenue_month: Mapped[str] = mapped_column(String, nullable=False, index=True)  # "YYYY-MM"
    operated_by: Mapped[str] = mapped_column(String, nullable=False)
    operated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.current_timestamp(), nullable=False)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
