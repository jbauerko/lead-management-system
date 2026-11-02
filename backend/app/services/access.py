from __future__ import annotations

from sqlalchemy import false
from app.db.models import Lead, User


def lead_access(user: User):
    """A lead and its case share the same access rules and current firm assignment."""
    if user.role == 'admin':
        return True
    if user.role == 'plaintiff':
        return Lead.plaintiff_id == user.id
    if user.role in ('attorney', 'paralegal') and user.firm_id:
        return Lead.firm_id == user.firm_id
    # If we cannot identify a supported role and firm, allow no access.
    return false()
