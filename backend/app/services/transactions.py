from __future__ import annotations

from contextlib import contextmanager
from functools import wraps
from sqlalchemy.orm import Session


class Transactions:
    """Save one business operation together across nested service calls.

    Required by instructions.md:
        Acceptance creates a case, and important changes have recorded history.
        The exercise does not prescribe a transaction implementation.

    Technical choices (not additional business requirements):
        All collaborating services share one session and this coordinator. Nested
        mutations flush as needed; only the outermost mutation commits or rolls
        back. This keeps a decision, its related records, and history together.
        Reads do not commit. Filesystem writes need separate cleanup because
        Postgres cannot roll them back.
    """
    def __init__(self, session: Session):
        self.session = session
        self.depth = 0

    @contextmanager
    def mutation(self):
        # A service may call another service that also starts a mutation.
        # Keep them in one transaction so we do not save half an operation.
        outermost = self.depth == 0
        self.depth += 1
        try:
            yield
            if outermost:
                self.session.commit()
        except Exception:
            if outermost:
                self.session.rollback()
            raise
        finally:
            self.depth -= 1


def transactional(method):
    @wraps(method)
    def wrapped(self, *args, **kwargs):
        with self.transactions.mutation():
            return method(self, *args, **kwargs)
    return wrapped
