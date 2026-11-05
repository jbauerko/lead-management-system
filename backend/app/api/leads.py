from app.api.dependencies import get_lead_service, get_note_service
from app.services.leads import LeadService
from app.services.notes import NoteService
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query
from app.api.auth import current_user
from app.db.models import Lead, User
from app.schemas.leads import LeadCreate, LeadResponse
from app.schemas.cases import AssignmentUpdate, AuditResponse


router = APIRouter(prefix='/leads', tags=['leads'])


@router.post('', response_model=LeadResponse, status_code=201)
def create(data: LeadCreate, service: LeadService = Depends(get_lead_service), user: User = Depends(current_user)):
    return service.submit(user, data)


@router.get('', response_model=list[LeadResponse])
def listing(region: str | None = Query(None, max_length=100), category: str | None = Query(None, max_length=100), q: str | None = Query(None, max_length=200), status: str | None = None, limit: int = Query(50, ge=1, le=100), offset: int = Query(0, ge=0),
            service: LeadService = Depends(get_lead_service), user: User = Depends(current_user)):
    return service.list(user, limit=limit, offset=offset, q=q, status=status, region=region, category=category)


@router.get('/{lead_id}', response_model=LeadResponse)
def detail(lead_id: UUID, service: LeadService = Depends(get_lead_service), user: User = Depends(current_user)):
    return service.get(user, lead_id)


@router.post('/{lead_id}/accept', response_model=LeadResponse)
def accept(lead_id: UUID, service: LeadService = Depends(get_lead_service), user: User = Depends(current_user)):
    return service.accept(user, lead_id)


@router.post('/{lead_id}/decline', response_model=LeadResponse)
def decline(lead_id: UUID, service: LeadService = Depends(get_lead_service), user: User = Depends(current_user)):
    return service.decline(user, lead_id)




@router.patch('/{lead_id}/assignment', response_model=LeadResponse)
def assignment(lead_id: UUID, data: AssignmentUpdate, service: LeadService = Depends(get_lead_service), user: User = Depends(current_user)):
    return service.reassign(user, lead_id, data.firm_id)


@router.get('/{lead_id}/history', response_model=list[AuditResponse])
def history(lead_id: UUID, limit: int = Query(50, ge=1, le=100), offset: int = Query(0, ge=0),
            service: LeadService = Depends(get_lead_service), user: User = Depends(current_user)):
    return service.history(user, lead_id, limit, offset)
