from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, ConfigDict


class DocumentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    lead_id: UUID
    uploader_id: UUID
    filename: str
    size_bytes: int
    content_type: str
    created_at: datetime


class FirmResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    name: str
