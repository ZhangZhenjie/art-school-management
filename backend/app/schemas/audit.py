from datetime import datetime

from pydantic import BaseModel, ConfigDict


class AuditLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    operator: str
    operated_at: datetime
    entity_type: str
    entity_id: int
    field_name: str
    old_value: str | None
    new_value: str | None
    note: str | None
