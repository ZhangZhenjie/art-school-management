from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base


class Schedule(Base):
    __tablename__ = "schedules"

    id: Mapped[str] = mapped_column(String, primary_key=True)  # e.g. "2C", "3F1"
    name: Mapped[str] = mapped_column(String, nullable=False)
    weekday: Mapped[int] = mapped_column(Integer, nullable=False)  # 2..7
    start_time: Mapped[str] = mapped_column(String, nullable=False)  # "HH:MM"
    end_time: Mapped[str] = mapped_column(String, nullable=False)
