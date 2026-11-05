from datetime import datetime
from typing import Literal
from uuid import UUID
from pydantic import BaseModel
from app.schemas.leads import LeadResponse


class AdminWorkResponse(BaseModel):
    id: UUID
    kind: Literal['leads', 'cases']
    lead: LeadResponse
    status: str
    created_at: datetime


class ProgressResponse(BaseModel):
    id: UUID
    progress: str
    status: str | None
    created_at: datetime
