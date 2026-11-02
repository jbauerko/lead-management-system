from app.schemas.audit import AuditChanges
from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, ConfigDict


class CaseResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    lead_id: UUID
    status: str
    progress: str
    created_at: datetime

from typing import Literal
from pydantic import Field


class CaseUpdate(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)
    status: Literal['open', 'in_progress', 'closed']
    progress: str = Field(max_length=20000)


class NoteCreate(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)
    body: str = Field(min_length=1, max_length=20000)


class NoteResponse(NoteCreate):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    case_id: UUID
    author_id: UUID
    authoring_firm_id: UUID
    created_at: datetime


class AssignmentUpdate(BaseModel):
    model_config = ConfigDict(extra='forbid')
    firm_id: UUID


class AuditResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    actor_id: UUID
    lead_id: UUID
    case_id: UUID | None
    action: str
    changes: AuditChanges
    created_at: datetime
