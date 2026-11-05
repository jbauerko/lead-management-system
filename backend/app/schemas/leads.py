from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, ConfigDict, EmailStr, Field


class LeadCreate(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)
    name: str = Field(min_length=1, max_length=200)
    email: EmailStr = Field(max_length=320)
    region: str = Field(min_length=1, max_length=100)
    category: str = Field(min_length=1, max_length=100)
    description: str = Field(min_length=1, max_length=20000)


class FirmSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    name: str


class LeadResponse(LeadCreate):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    plaintiff_id: UUID
    firm_id: UUID | None
    status: str
    created_at: datetime
    firm: FirmSummary | None = None
    case_id: UUID | None = None
