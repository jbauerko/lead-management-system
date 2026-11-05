from uuid import UUID
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.api.auth import current_user
from app.db.models import User
from app.db.session import get_session
from app.services.admin import AdminService
from app.schemas.admin import AdminWorkResponse
from app.schemas.cases import AuditResponse

router = APIRouter(prefix='/admin', tags=['admin'])


def get_admin_service(session: Session = Depends(get_session)) -> AdminService:
    return AdminService(session)


@router.get('/work', response_model=list[AdminWorkResponse])
def work(limit: int = Query(50, ge=1, le=100), offset: int = Query(0, ge=0),
         q: str | None = Query(None, max_length=200), firm_id: UUID | None = None, attention: bool = False,
         service: AdminService = Depends(get_admin_service), user: User = Depends(current_user)):
    return service.list_work(user, limit, offset, q, firm_id, attention)


@router.get('/activity', response_model=list[AuditResponse])
def activity(limit: int = Query(50, ge=1, le=100), offset: int = Query(0, ge=0),
             service: AdminService = Depends(get_admin_service), user: User = Depends(current_user)):
    return service.activity(user, limit, offset)
