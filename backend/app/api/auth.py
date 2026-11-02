from secrets import compare_digest
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from itsdangerous import BadSignature, URLSafeTimedSerializer
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from app.core.config import get_settings
from app.db.models import User
from app.db.seed import DEMO_USERS
from app.db.session import get_session

router = APIRouter(prefix='/auth', tags=['auth'])
bearer = HTTPBearer(auto_error=False)


def signer():
    return URLSafeTimedSerializer(get_settings().auth_secret, salt='demo-access-token')


class Login(BaseModel):
    email: str
    password: str


@router.post('/login')
def login(data: Login, session: Session = Depends(get_session)):
    email = data.email.strip().lower()
    if email not in DEMO_USERS or not compare_digest(data.password.encode(), get_settings().demo_password.encode()):
        raise HTTPException(401, 'Invalid credentials')
    user = session.scalar(select(User).where(func.lower(User.email) == email, User.active.is_(True)))
    if user is None:
        raise HTTPException(401, 'Invalid credentials')
    return {'access_token': signer().dumps(str(user.id)), 'token_type': 'bearer', 'expires_in': 3600}


def current_user(credentials: HTTPAuthorizationCredentials | None = Depends(bearer), session: Session = Depends(get_session)) -> User:
    try:
        if credentials is None:
            raise ValueError()
        user_id = UUID(signer().loads(credentials.credentials, max_age=3600))
    except (BadSignature, ValueError, TypeError):
        raise HTTPException(401, 'Invalid or expired token', headers={'WWW-Authenticate': 'Bearer'}) from None
    user = session.get(User, user_id)
    if user is None or not user.active:
        raise HTTPException(401, 'User unavailable')
    return user


@router.get('/me')
def me(user: User = Depends(current_user)):
    return {'id': user.id, 'name': user.name, 'email': user.email, 'role': user.role, 'firm_id': user.firm_id}
