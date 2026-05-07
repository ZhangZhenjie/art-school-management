"""Helper for writing audit_logs entries.

TODO M2: provide log_change(db, operator, entity_type, entity_id, field, old, new, note).
"""
from sqlalchemy.orm import Session

from ..models.audit_log import AuditLog


def log_change(
    db: Session,
    *,
    operator: str,
    entity_type: str,
    entity_id: int,
    field_name: str,
    old_value: str | None,
    new_value: str | None,
    note: str | None = None,
) -> AuditLog:
    entry = AuditLog(
        operator=operator,
        entity_type=entity_type,
        entity_id=entity_id,
        field_name=field_name,
        old_value=old_value,
        new_value=new_value,
        note=note,
    )
    db.add(entry)
    return entry
