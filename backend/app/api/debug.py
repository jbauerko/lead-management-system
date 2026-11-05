"""Opt-in local-demo reference data. Available before login; disabled by default."""
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from app.core.config import get_settings
from app.db.models import Firm, RoutingRule, User
from app.db.seed import DEMO_USERS
from app.db.session import get_session

router = APIRouter(prefix='/debug', tags=['demo debug'])


@router.get('/demo')
def demo(response: Response, session: Session = Depends(get_session)):
    settings = get_settings()
    if not settings.demo_debug_enabled:
        raise HTTPException(404, 'Not found')
    response.headers['Cache-Control'] = 'no-store'
    accounts = session.execute(select(User, Firm.name).outerjoin(Firm, Firm.id == User.firm_id)
        .where(func.lower(User.email).in_(list(DEMO_USERS))).order_by(User.role, User.email)).all()
    mappings = session.execute(select(RoutingRule, Firm).join(Firm).order_by(RoutingRule.region, RoutingRule.category)).all()
    return {
        'password': settings.demo_password,
        'accounts': [{'name': user.name, 'email': user.email, 'role': user.role, 'firm': firm,
                      'active': user.active} for user, firm in accounts],
        'mappings': [{'region': rule.region, 'category': rule.category, 'firm': firm.name,
                      'active': firm.active} for rule, firm in mappings],
    }
