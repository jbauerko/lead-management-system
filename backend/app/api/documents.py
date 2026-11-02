from uuid import UUID
from urllib.parse import quote
from fastapi import APIRouter, Depends, UploadFile, Query
from fastapi.responses import StreamingResponse
from app.api.auth import current_user
from app.api.dependencies import get_document_service
from app.db.models import User
from app.services.documents import DocumentService
from app.schemas.documents import DocumentResponse

router = APIRouter(tags=['documents'])


@router.post('/leads/{lead_id}/documents', response_model=DocumentResponse, status_code=201)
def upload(lead_id: UUID, file: UploadFile, service: DocumentService = Depends(get_document_service), user: User = Depends(current_user)):
    try:
        return service.upload(user, lead_id, file.filename or '', file.file)
    finally:
        file.file.close()


@router.get('/leads/{lead_id}/documents', response_model=list[DocumentResponse])
def listing(lead_id: UUID, limit: int = Query(50, ge=1, le=100), offset: int = Query(0, ge=0),
            service: DocumentService = Depends(get_document_service), user: User = Depends(current_user)):
    return service.list(user, lead_id, limit, offset)


@router.post('/cases/{case_id}/documents', response_model=DocumentResponse, status_code=201)
def case_upload(case_id: UUID, file: UploadFile, service: DocumentService = Depends(get_document_service), user: User = Depends(current_user)):
    try:
        return service.upload(user, service.case_lead(user, case_id), file.filename or '', file.file)
    finally:
        file.file.close()


@router.get('/cases/{case_id}/documents', response_model=list[DocumentResponse])
def case_listing(case_id: UUID, limit: int = Query(50, ge=1, le=100), offset: int = Query(0, ge=0),
                 service: DocumentService = Depends(get_document_service), user: User = Depends(current_user)):
    return service.list(user, service.case_lead(user, case_id), limit, offset)


@router.get('/documents/{document_id}/download')
def download(document_id: UUID, service: DocumentService = Depends(get_document_service), user: User = Depends(current_user)):
    document, stream = service.download(user, document_id)
    def chunks():
        try:
            while chunk := stream.read(65536):
                yield chunk
        finally:
            stream.close()
    return StreamingResponse(chunks(), media_type='application/pdf', headers={
        'Content-Disposition': "attachment; filename*=UTF-8''" + quote(document.filename, safe=''),
        'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store'})
