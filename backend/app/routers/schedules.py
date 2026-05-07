from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models.schedule import Schedule
from ..models.user import User

router = APIRouter()


@router.get("")
def list_schedules(_: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.query(Schedule).order_by(Schedule.weekday, Schedule.start_time).all()
    return [
        {
            "id": r.id,
            "name": r.name,
            "weekday": r.weekday,
            "start_time": r.start_time,
            "end_time": r.end_time,
        }
        for r in rows
    ]
