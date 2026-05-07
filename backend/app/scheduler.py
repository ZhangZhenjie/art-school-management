"""APScheduler — monthly auto-generate sessions on day 1 at 00:05 (spec §4.6).

Runs in-process inside uvicorn. With multiple workers this would double-fire; the systemd
unit launches a single uvicorn worker so we're safe.
"""
from __future__ import annotations

import logging

import pytz
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from .config import settings
from .database import SessionLocal
from .services import sessions as sess_svc

logger = logging.getLogger("art_school.scheduler")


def _generate_current_month() -> None:
    from datetime import datetime
    tz = pytz.timezone(settings.TIMEZONE or "UTC")
    now = datetime.now(tz)
    with SessionLocal() as db:
        try:
            res = sess_svc.generate_for_month(db, now.year, now.month)
            db.commit()
            logger.info(
                "auto-generated %s-%02d: inserted=%d skipped=%d students=%d",
                now.year, now.month, res.inserted, res.skipped, res.students_considered,
            )
        except Exception:
            db.rollback()
            logger.exception("auto-generate failed")


def start_scheduler() -> BackgroundScheduler:
    sched = BackgroundScheduler(timezone=settings.TIMEZONE or "UTC")
    sched.add_job(
        _generate_current_month,
        CronTrigger(day=1, hour=0, minute=5, timezone=settings.TIMEZONE or "UTC"),
        id="monthly_generate_sessions",
        replace_existing=True,
    )
    sched.start()
    logger.info("scheduler started — monthly_generate_sessions: day=1 hour=0 minute=5 (%s)", settings.TIMEZONE)
    return sched
