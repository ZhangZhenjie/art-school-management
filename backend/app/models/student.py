from datetime import date

from sqlalchemy import Boolean, Date, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base


class Student(Base):
    __tablename__ = "students"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    birthday: Mapped[date | None] = mapped_column(Date, nullable=True)
    email: Mapped[str | None] = mapped_column(String, nullable=True)
    parent_name: Mapped[str | None] = mapped_column(String, nullable=True)
    phone: Mapped[str | None] = mapped_column(String, nullable=True)
    # spec §3.2: soft reference — may be a real schedules.id, "1O" (offline private), or NULL.
    # No FK so legacy "1O" round-trips cleanly without a placeholder schedules row.
    schedule_id: Mapped[str | None] = mapped_column(String, nullable=True, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    packages: Mapped[list["Package"]] = relationship(  # noqa: F821
        "Package", back_populates="student", cascade="all, delete-orphan"
    )
