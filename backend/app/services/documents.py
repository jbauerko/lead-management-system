from __future__ import annotations

from pathlib import PurePosixPath
from typing import BinaryIO
from uuid import UUID
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.db.models import Document, User
from app.services.leads import LeadService
from app.services.cases import CaseService
from app.services.assignments import AssignmentService
from app.services.errors import NotFound
from app.services.transactions import Transactions
from app.storage.local import Storage


class InvalidDocument(Exception):
    pass


class DocumentTooLarge(Exception):
    pass


class DocumentService:
    """Share PDFs while keeping access tied to the current work assignment.

    Required by instructions.md:
        Plaintiffs upload/view PDFs for their own work; staff exchange case PDFs
        with them. Other plaintiffs cannot access those files. After reassignment,
        the old firm loses future access and the new firm gets plaintiff documents.

    Assumptions we chose:
        All attachments are shared with the plaintiff, current firm, and admins,
        including PDFs uploaded by a former firm. There are no firm-private PDFs.
        Uploads are allowed before case acceptance as well as afterward. Documents
        have no edit/delete API. The default per-file limit is 10 MiB; basic PDF
        markers are checked, but full parsing and malware scanning are not provided.

    Technical choices:
        Store metadata on the lead so files survive acceptance and reassignment.
        Use injected private storage and generated keys. Upload owns its transaction
        and removes saved bytes on ordinary database failure; a process crash may
        still leave an orphan file. Check current access for every download;
        already saved copies and downloads in progress cannot be revoked.
    """

    def __init__(self, session: Session, transactions: Transactions, leads: LeadService,
                 cases: CaseService, assignments: AssignmentService, storage: Storage, max_bytes: int):
        self.session, self.transactions = session, transactions
        self.leads, self.cases, self.assignments = leads, cases, assignments
        self.storage, self.max_bytes = storage, max_bytes

    def case_lead(self, user: User, case_id: UUID) -> UUID:
        # Keep files on the lead so they are still available when it becomes a case.
        return self.cases.get(user, case_id).lead_id

    def upload(self, user: User, lead_id: UUID, filename: str, source: BinaryIO) -> Document:
        key = None
        try:
            # This upload owns the transaction so we can remove the file if saving its record fails.
            with self.transactions.mutation():
                # Lock the assignment, then check access before writing the file.
                self.assignments.lock(lead_id)
                self.leads.get(user, lead_id)
                # Keep the original name for display; use a generated key to store the file.
                filename = PurePosixPath(filename.replace('\\', '/')).name
                if not filename.lower().endswith('.pdf') or len(filename) > 255 or any(ord(c) < 32 or ord(c) == 127 for c in filename):
                    raise InvalidDocument('A PDF filename of at most 255 characters is required')
                source.seek(0, 2)
                size = source.tell()
                if size > self.max_bytes:
                    raise DocumentTooLarge('PDF exceeds upload size limit')
                source.seek(0)
                # Check for basic PDF markers. This does not guarantee a safe or valid PDF.
                header = source.read(8)
                source.seek(max(0, size - 1024))
                tail = source.read()
                source.seek(0)
                if not header.startswith(b'%PDF-') or b'%%EOF' not in tail:
                    raise InvalidDocument('File must contain a PDF header and end marker')
                key = self.storage.save(source)
                document = Document(lead_id=lead_id, uploader_id=user.id, storage_key=key,
                                    filename=filename, size_bytes=size, content_type='application/pdf')
                self.session.add(document)
                self.session.flush()
                self.session.refresh(document)
            return document
        except Exception:
            # Rolling back Postgres does not remove the file, so clean it up here.
            # A process crash can still leave a file without a database record.
            if key is not None:
                self.storage.delete(key)
            raise

    def list(self, user: User, lead_id: UUID, limit: int, offset: int) -> list[Document]:
        self.leads.get(user, lead_id)
        return list(self.session.scalars(select(Document).where(Document.lead_id == lead_id)
            .order_by(Document.created_at.desc(), Document.id.desc()).limit(limit).offset(offset)).all())

    def download(self, user: User, document_id: UUID) -> tuple[Document, BinaryIO]:
        document = self.session.get(Document, document_id)
        if document is None:
            raise NotFound('Document not found')
        # Use the current assignment, even if a different firm uploaded the file.
        # Downloads already started or saved cannot be taken back.
        self.leads.get(user, document.lead_id)
        try:
            stream = self.storage.open(document.storage_key)
        except FileNotFoundError:
            raise NotFound('Document file unavailable') from None
        return document, stream
