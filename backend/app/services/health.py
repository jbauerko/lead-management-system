from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.orm import Session


def check_database(session: Session) -> None:
    session.execute(text("SELECT 1"))
