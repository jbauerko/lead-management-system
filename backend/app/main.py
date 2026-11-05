from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.router import router
from app.core.config import get_settings

app = FastAPI(title="Lead Management API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[get_settings().frontend_origin],
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Content-Type", "Authorization"],
)
app.include_router(router, prefix="/api")

from app.api.auth import router as auth_router
from app.api.leads import router as leads_router
app.include_router(auth_router, prefix="/api")
app.include_router(leads_router, prefix="/api")

from fastapi import Request
from fastapi.responses import JSONResponse
from app.api.cases import router as cases_router
from app.services.errors import Conflict, NotFound
app.include_router(cases_router, prefix='/api')


@app.exception_handler(NotFound)
@app.exception_handler(Conflict)
@app.exception_handler(PermissionError)
def service_error(request: Request, error: Exception):
    status = 404 if isinstance(error, NotFound) else 409 if isinstance(error, Conflict) else 403
    return JSONResponse(status_code=status, content={'detail': str(error)})

from app.api.documents import router as document_router
from app.api.firms import router as firm_router
from app.services.documents import InvalidDocument, DocumentTooLarge
app.include_router(document_router, prefix='/api')
app.include_router(firm_router, prefix='/api')


@app.exception_handler(InvalidDocument)
@app.exception_handler(DocumentTooLarge)
def document_error(request: Request, error: Exception):
    return JSONResponse(status_code=413 if isinstance(error, DocumentTooLarge) else 422,
                        content={'detail': str(error)})

from app.api.admin import router as admin_router
app.include_router(admin_router, prefix="/api")

from app.api.debug import router as debug_router
app.include_router(debug_router, prefix="/api")
