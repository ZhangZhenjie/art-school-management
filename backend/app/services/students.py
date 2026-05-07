"""Student-level business helpers — status tags, totals.

Status rules (spec §4.1) — derived from packages, never stored:
  - arrears        : any package remaining_classes < 0
  - low_balance    : sum(remaining) <= 4 AND >= 0
  - expiring_soon  : among packages with remaining > 0, the latest-ending package's
                     end_date is within 30 days of today
"""
from __future__ import annotations

from datetime import date, timedelta
from typing import Iterable

import pytz

from ..config import settings
from ..models.package import Package


def _today() -> date:
    return date.today() if settings.TIMEZONE == "" else _today_tz()


def _today_tz() -> date:
    return _now_tz().date()


def _now_tz():
    from datetime import datetime
    tz = pytz.timezone(settings.TIMEZONE or "UTC")
    return datetime.now(tz)


def total_remaining(packages: Iterable[Package]) -> float:
    return sum(p.remaining_classes for p in packages)


def status_tags(packages: Iterable[Package]) -> list[str]:
    pkgs = list(packages)
    tags: list[str] = []
    if any(p.remaining_classes < 0 for p in pkgs):
        tags.append("arrears")
    total = total_remaining(pkgs)
    if 0 <= total <= 4:
        tags.append("low_balance")
    active = [p for p in pkgs if p.remaining_classes > 0]
    if active:
        latest_end = max(p.end_date for p in active)
        if (latest_end - _today_tz()) <= timedelta(days=30):
            tags.append("expiring_soon")
    return tags
