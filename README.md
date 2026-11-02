# Lead management system

Initial React/TypeScript + FastAPI scaffold. Demo auth, lead/case workflows, private notes, reassignment, and PDF endpoints
are implemented. Frontend workflow screens remain unimplemented. Domain tables and the initial migration are included.

## Run locally

Prerequisites: Docker Compose, Python 3.12+ with uv, and Node.js 22 LTS with npm.

From the repository root:

```sh
docker compose up -d --wait
```

Backend (separate terminal):

```sh
cd backend
cp .env.example .env
uv sync
uv run alembic upgrade head
uv run uvicorn app.main:app --reload
```

Frontend (separate terminal):

```sh
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. Vite proxies `/api` to FastAPI.
API documentation: http://localhost:8000/docs.
`/api/health` checks the process; `/api/ready` also queries Postgres.

## Structure and conventions

- `frontend/`: React UI, served by Vite in development.
- `backend/app/api/`: HTTP routes, validation, and dependency wiring.
- `backend/app/services/`: application workflows; future mutations own transaction boundaries here.
- `backend/app/db/`: SQLAlchemy models, database sessions, and focused queries.
- `backend/app/core/`: environment configuration and future authentication helpers.

Postgres is local and persisted in a Docker volume. Credentials in Compose are
for local development only. Change `DATABASE_URL` to use another Postgres host.
No tables are created at startup. Apply schema changes with `uv run alembic upgrade head` from `backend/`.
Use `uv run alembic revision --autogenerate -m "description"` for future changes;
review generated SQL before applying. `uv run alembic check` detects model drift.
Downgrades delete affected tables and their data.

PDF storage is planned as a private local directory (configured by
`PDF_STORAGE_PATH`) with document metadata in Postgres. Upload/download endpoints
will enforce authorization. Local storage and authenticated endpoints are implemented below.

## Checks

```sh
cd frontend
npm run build
```

Stop Postgres with `docker compose down`; the data volume remains.
`docker compose down -v` deletes the local database volume.

## Demo backend workflow

After applying migrations, run `uv run python -m app.db.seed` from `backend/`.
This inserts missing demo fixtures without overwriting edits; run it repeatedly safely.
The command owns one transaction. It does not create sample leads or cases.

Sign in through `POST /api/auth/login` with an email below and password
`demo-password` (override with `DEMO_PASSWORD`). Use the returned token in
`Authorization: Bearer <token>`. Tokens expire after one hour; demo logout is
client-side token removal, without revocation. `AUTH_SECRET` must be changed before
any deployment. These documented credentials and default secret are local demo only.

- `plaintiff@example.com`, `plaintiff2@example.com`
- `attorney@example.com`, `paralegal@example.com` (North Legal)
- `attorney2@example.com`, `paralegal2@example.com` (South Legal)
- `admin@example.com`

Use `/api/auth/me` to inspect identity. A plaintiff can `POST /api/leads` with
`name`, `email`, `region`, `category`, and `description`. Routing recognizes
`NY` / `personal_injury` and `CA` / `employment`; other pairs remain pending.
Region is uppercased and category lowercased. Inactive firms are not routed to.
`GET /api/leads?limit=50&offset=0` and `GET /api/leads/{id}` enforce plaintiff
ownership, staff firm assignment, or admin access. Submission and initial audit
history are committed atomically. Swagger at `/docs` supports trying these endpoints.
Frontend workflow screens do not exist yet.

## Backend verification

Tests require a running PostgreSQL database and permission to create schemas:

```sh
cd backend
TEST_DATABASE_URL=postgresql+psycopg://leads:leads@localhost:5432/leads uv run pytest -q
```

Each test migrates and drops a uniquely named schema; application tables are not
modified. Tests check migration drift, downgrade, constraints, repeatable seed data,
authentication, routing, audit creation, and access isolation.

## Firm review and case retrieval

Assigned attorneys and paralegals can use `POST /api/leads/{id}/accept` or
`POST /api/leads/{id}/decline` (no body). Only assigned leads may be reviewed;
repeated decisions return 409. Acceptance creates exactly one case, and both
operations record an audit event in the same transaction. A PostgreSQL row lock
serializes simultaneous decisions. Other firms receive 404; plaintiffs and admins
receive 403 because review is a firm operation.

`GET /api/cases?limit=50&offset=0` and `GET /api/cases/{id}` return case progress
without private notes. Plaintiffs see their own cases, staff see their currently
assigned firm's cases, and admins see all cases. Case assignment is inherited
from the lead. Progress updates and notes are described below.

## Case management and admin resolution

- `PATCH /api/cases/{id}` accepts `status` (`open`, `in_progress`, `closed`)
  and `progress`. Current firm staff may update; changes are audited atomically.
- `POST /api/cases/{id}/notes` accepts `body`; `GET` lists private notes.
  Staff see only notes authored by their currently assigned firm; admins see all;
  plaintiffs have no access. Notes cannot be edited or transferred through this API.
- Admins use `PATCH /api/leads/{id}/assignment` or
  `PATCH /api/cases/{id}/assignment` with `firm_id` to move work to an active firm.
  Unmatched/declined leads become assigned; accepted leads retain their case.
  The lead remains the single assignment source. Existing notes retain ownership.
- `GET /api/leads/{id}/history` exposes paginated audit history to admins.
- Lead and case lists support `q` (plaintiff name, intake email, description) and
  `status`, combined with the existing access scope and pagination. Substring
  search is a simple baseline and may need PostgreSQL trigram indexes at scale.

Frontend workflow screens remain unimplemented.

## Service composition

Entity services (`LeadService`, `CaseService`, `NoteService`, `FirmService`,
`AuditService`) receive collaborators through their constructors. FastAPI providers
in `app/api/dependencies.py` assemble one request-scoped graph; the framework caches
dependencies so every service uses the same session and `Transactions` instance.
`AssignmentService` owns shared assignment changes and locking, preventing a circular
lead/case dependency. Lead acceptance calls the injected case and audit services.

Mutations use `@transactional`: nested calls flush but only the outermost operation
commits or rolls back. This also works outside HTTP when constructing the same graph.
Read operations do not commit. No generic CRUD base class or repository is required.

## PDFs and firm picker

- `POST /api/leads/{id}/documents` and `POST /api/cases/{id}/documents` accept
  multipart field `file`. Plaintiffs, current firm staff, and admins can upload
  to work they can access. Both paths store attachments on the underlying lead.
- `GET` on either path returns paginated metadata (`limit`, `offset`), without
  exposing storage keys or filesystem paths.
- `GET /api/documents/{id}/download` authorizes each request and streams an attachment
  with private/no-store caching. Reassignment changes future access immediately;
  already downloaded copies or in-flight responses cannot be revoked.
- `GET /api/firms` returns paginated active firms for admins only.

PDFs are stored under generated UUID keys in `PDF_STORAGE_PATH` (default
`backend/data/pdfs` when run from `backend/`). This directory must persist alongside
the Postgres volume and be backed up separately. No files are publicly served.
`Storage` is an injectable protocol; `LocalStorage` can be replaced with object
storage. Ordinary upload/database failures clean up saved files; process crashes
between file creation and commit may leave orphan files requiring reconciliation.

The default per-file limit is 10 MiB (`PDF_MAX_BYTES`). Validation checks the
filename, PDF header, and EOF marker, not full PDF correctness or malware. There is
no malware scanner. Multipart uploads are spooled by the web framework before the
service checks size; a deployed ingress should also bound total request size.
No PDF delete endpoint is provided. Synthetic PDF bytes in tests exercise storage
and access, not rendering. Real PDFs can be uploaded through Swagger `/docs`.
