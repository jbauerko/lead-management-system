from app.api.dependencies import get_case_service, get_note_service
from app.services.cases import CaseService
from app.services.notes import NoteService
from uuid import UUID
from fastapi import APIRouter, Depends, Query
from app.api.auth import current_user
from app.db.models import User
from app.schemas.cases import CaseResponse
from app.schemas.cases import CaseUpdate, NoteCreate, NoteResponse
from app.schemas.cases import AssignmentUpdate


router = APIRouter(prefix='/cases', tags=['cases'])


@router.get('', response_model=list[CaseResponse])
def listing(q: str | None = Query(None, max_length=200), status: str | None = None, limit: int = Query(50, ge=1, le=100), offset: int = Query(0, ge=0),
            service: CaseService = Depends(get_case_service), user: User = Depends(current_user)):
    return service.list(user, limit=limit, offset=offset, q=q, status=status)


@router.get('/{case_id}', response_model=CaseResponse)
def detail(case_id: UUID, service: CaseService = Depends(get_case_service), user: User = Depends(current_user)):
    return service.get(user, case_id)




@router.patch('/{case_id}', response_model=CaseResponse)
def update(case_id: UUID, data: CaseUpdate, service: CaseService = Depends(get_case_service), user: User = Depends(current_user)):
    return service.update(user, case_id, data)


@router.post('/{case_id}/notes', response_model=NoteResponse, status_code=201)
def note(case_id: UUID, data: NoteCreate, service: NoteService = Depends(get_note_service), user: User = Depends(current_user)):
    return service.create(user, case_id, data.body)


@router.get('/{case_id}/notes', response_model=list[NoteResponse])
def notes(case_id: UUID, limit: int = Query(50, ge=1, le=100), offset: int = Query(0, ge=0),
          service: NoteService = Depends(get_note_service), user: User = Depends(current_user)):
    return service.list(user, case_id, limit, offset)



@router.patch('/{case_id}/assignment', response_model=CaseResponse)
def assignment(case_id: UUID, data: AssignmentUpdate, service: CaseService = Depends(get_case_service), user: User = Depends(current_user)):
    return service.reassign(user, case_id, data.firm_id)
