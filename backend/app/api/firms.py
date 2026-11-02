from fastapi import APIRouter, Depends, Query
from app.api.auth import current_user
from app.api.dependencies import get_firm_service
from app.db.models import User
from app.schemas.documents import FirmResponse
from app.services.firms import FirmService

router = APIRouter(prefix='/firms', tags=['firms'])


@router.get('', response_model=list[FirmResponse])
def listing(limit: int = Query(50, ge=1, le=100), offset: int = Query(0, ge=0),
            service: FirmService = Depends(get_firm_service), user: User = Depends(current_user)):
    return service.list_active(user, limit, offset)
