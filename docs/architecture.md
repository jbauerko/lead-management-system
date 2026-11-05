# Architecture and development context

This document explains the implementation, tradeoffs, and maintenance commands.
For setup and a demo walkthrough, start with the [README](../README.md).

## Structure and ownership


```text
frontend/src/
  api/          Typed API contracts and authenticated requests
  auth/         Login state and role-based navigation
  components/   Shared forms, documents, history, and layouts
  hooks/        Loading, search, and firm-picker helpers
  pages/        Plaintiff, firm, and admin workflows
frontend/tests/ UI interaction tests
backend/app/
  api/          Routes, request validation, and dependency wiring
  schemas/      Pydantic request/response contracts
  services/     Business rules, authorization, and transaction boundaries
  db/           SQLAlchemy models, sessions, and demo seeds
  storage/      Private file-storage interface and local implementation
  core/         Environment settings
backend/migrations/ Alembic migration history
backend/tests/      PostgreSQL integration tests
```

A single backend keeps transactions and authorization in one place while React
provides the role-specific screens. FastAPI dependencies assemble entity services
with a shared SQLAlchemy session and transaction coordinator. Only the outermost
mutation commits; nested services flush without saving half an operation.
Acceptance locks the lead, creates its case, and writes history together.

The lead owns plaintiff identity and current assignment. A case uses that same
assignment, so moving either moves both. Documents stay attached to the lead
through acceptance and reassignment. Private notes separately store their
original authoring firm. Case responses and shared progress endpoints do not
include private notes. Account ownership comes from the authenticated plaintiff,
not the inquiry's contact email. Audit events link the actor, lead, optional case,
and changed values; reassignment reasons are stored with those changes.

SQLAlchemy models share UUID and timestamp fields through a small mixin. Separate
Pydantic contracts control which fields the API accepts and returns. Database
constraints enforce valid roles/statuses and staff membership, case-insensitive
email uniqueness, one case per lead, and one routing rule per region/category pair.
Restrictive foreign keys prevent silent deletion of related history, while composite
indexes support scoped lists. Routing normalizes region/category keys and selects
only active firms; unmatched leads remain pending.

Services enforce authorization, workflow consistency, and original note ownership;
these rules are not all database constraints and do not prevent direct SQL edits.
Review and reassignment share the lead lock. The plaintiff progress endpoint returns
shared updates without private notes or audit actors. Service docstrings distinguish
exercise requirements from implementation assumptions.

Postgres runs locally in a Docker volume. `DATABASE_URL` can point to another
PostgreSQL host without changing services. Alembic owns table creation and changes;
tables are not created automatically on API startup. Review generated migrations
before applying. Downgrades may delete tables and their data.

## PDFs and authentication

PDF bytes live under generated UUID keys in `PDF_STORAGE_PATH`, defaulting to
`backend/data/pdfs` when the API runs from `backend/`. Postgres stores metadata.
This directory must persist and be backed up separately from the database.
`Storage` is injectable so an object-storage implementation can replace local files.

Uploads and downloads check current work access. Metadata responses hide storage
keys, and no file directory is publicly served. Downloads are authenticated
attachments with `Cache-Control: no-store`. The browser fetches a PDF with its
bearer token before displaying a temporary preview or saving a download.

Demo login returns a signed bearer token valid for one hour. The frontend keeps
it in sessionStorage for the current tab. Logout removes it locally, and a 401
clears the frontend login. The API loads identity, role, and membership from the
database; frontend navigation guards do not grant access. Registration and password
management are intentionally absent, as allowed by the exercise.

## Assumptions, limitations, and scale

- Each staff member belongs to one firm. Attorneys and paralegals have the same
  workflow permissions. All demo admins can inspect notes and audit history.
- Only staff accept/decline and update case progress. Admins resolve inquiries by
  assignment. Case statuses are `open`, `in_progress`, and `closed`; reopening is
  allowed. Private notes are created on accepted cases, not unaccepted leads.
- All PDFs are shared with the plaintiff, current firm, and admins, including
  files uploaded by a prior firm. Notes retain original ownership. Already saved
  documents and in-flight downloads cannot be revoked.
- PDF validation checks filename, size, header, and EOF marker. It does not parse
  the entire PDF or scan for malware. The default per-file limit is 10 MiB via
  `PDF_MAX_BYTES`; multipart bodies are spooled before this service check. A deployed
  ingress should also cap request size. There is no document deletion endpoint.
- Ordinary database failures remove newly saved files. A crash between storage and
  database commit can leave orphan files; reconciliation is not implemented.
- Documented passwords and the default signing secret are for local demo use.
  Server-side token revocation, login throttling, and production authentication
  hardening are not implemented. Change `AUTH_SECRET` before deployment.
- History is append-only through services, not protected against direct database
  edits. Assignment and important status/progress changes are recorded; document
  uploads and note creation are not separate audit events.
- Lists and related records are paginated, and indexes support scoped queries.
  Search uses substring matching and pagination uses offsets. Performance at
  100,000 leads has not been benchmarked; trigram indexes and cursor pagination are
  potential next steps if measurements justify them. This is one local app with
  filesystem storage, not a horizontally deployed service.
- There is no hosted demo. A production static host would need frontend-route
  fallback to `index.html` and an `/api` proxy to FastAPI. The supplied mocks' people,
  firms, and documents are examples; the screens display actual persisted demo data.

## Development and verification

Run these commands from the repository root unless a different directory is shown.


Run `make help` for the complete list.

| Command | Purpose |
| --- | --- |
| `make setup` | Install dependencies, prepare Postgres, migrate, seed |
| `make dev` | Run both dev servers |
| `make install` | Install backend/frontend dependencies from lockfiles |
| `make check` | Backend tests, frontend tests, and frontend type-check/build |
| `make test-backend` | Start Postgres and test using isolated schemas |
| `make test-frontend` | Run frontend tests |
| `make build` | Type-check and build the frontend |
| `make migrate` | Apply migrations to the configured app database |
| `make migration message="add field"` | Generate a migration for review |
| `make migration-check` | Check the migrated app database for model drift |
| `make seed` | Insert missing demo users, firms, and mappings |
| `make db-logs` | Follow Postgres logs |
| `make db-down` | Stop Postgres, keeping its data volume |

For frontend formatting, run `npm run format` or `npm run format:check` from
`frontend/`. Both include source and tests.

`make env` creates `backend/.env` only when missing. See
[backend/.env.example](../backend/.env.example) for settings. Tests use
`TEST_DATABASE_URL` separately from the app's `DATABASE_URL`:

```sh
make test-backend TEST_DATABASE_URL=postgresql+psycopg://leads:leads@localhost:5432/leads
```

The target starts local Compose even if another test database is specified. To
skip Compose with an existing PostgreSQL server:

```sh
cd backend
TEST_DATABASE_URL=postgresql+psycopg://leads:leads@localhost:5432/leads uv run pytest -q
```

Backend tests create, migrate, check, and drop uniquely named schemas. The test
user needs schema creation permission; application tables are not modified.
Frontend tests in `frontend/tests/` exercise user interactions with mocked HTTP.
They are included in TypeScript checks. Backend tests live in `backend/tests/`
and cover constraints, routing, authentication, isolation, reassignment, audit
history, upload cleanup, and concurrent acceptance. `make check` does not need
migrations on the app database because backend tests migrate their own schemas.
Run `make migrate` before `make migration-check` on the app database.


## Local demo reference

In the Vite development server, press **Ctrl+[** to toggle the account/routing
reference; Escape closes it too. It reads current database values each time it
opens. `DEMO_DEBUG_ENABLED=true` in `backend/.env` enables `/api/debug/demo` before
login. The example environment enables it for local use; the backend default is
false. Keep it disabled in a deployed environment because it includes demo login
credentials. The panel is omitted from production frontend builds.
