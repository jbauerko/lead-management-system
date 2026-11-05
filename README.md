# Lead management system

Initial React/TypeScript + FastAPI scaffold. Demo auth, lead/case workflows, private notes, reassignment, and PDF endpoints
are implemented. Plaintiff, firm, and admin workflow screens are implemented. Domain tables and the initial migration are included.

## Run locally

Prerequisites: GNU Make, Docker Compose v2, Python 3.12+ with uv, and Node.js
22 LTS with npm on your PATH. Commands work on Linux/macOS/WSL; on Windows use WSL.
If you use nvm, run `nvm use 22` first.

From the repository root:

```sh
make setup  # Install locked dependencies, start Postgres, migrate, seed demo users
make dev    # Run API + UI together
```

Ctrl-C stops both development servers and their reload workers. Postgres stays
running; `make db-down` stops it while preserving data. `make dev` reapplies
migrations and inserts missing seed records without overwriting existing demo data.
It expects dependencies installed by `make setup` or `make install`. Both servers
use fixed ports, and startup fails if a port is occupied. Stop your existing dev
servers before running `make dev`.

For separate terminals, run `make db-up`, `make migrate`, `make seed`, then
`make backend` and `make frontend` in their respective terminals.

Run `make help` for the full list. Common commands:

| Command | Purpose |
| --- | --- |
| `make check` | Backend/frontend tests plus frontend type-check/build |
| `make test-backend` | Start local Postgres and run isolated-schema tests |
| `make test-frontend` | Run frontend tests |
| `make build` | Type-check and build the frontend |
| `make migrate` | Apply migrations to the configured database |
| `make migration message="add field"` | Generate a migration for review |
| `make migration-check` | Check the migrated database against models |
| `make seed` | Insert missing demo identities and routing rules |
| `make db-logs` | Follow database logs |

`make env` creates `backend/.env` only when missing. Edit that file for API settings;
it is never overwritten. Tests use `TEST_DATABASE_URL`, independently of the app's
`DATABASE_URL`, and create/drop unique schemas rather than changing app tables.
Override it with `make test-backend TEST_DATABASE_URL=postgresql+psycopg://…`.
That target starts the local Compose database even when testing another host.
Use `cd backend && TEST_DATABASE_URL=… uv run pytest -q` to skip Compose in CI.
`make check` does not require migrations on the app database because tests migrate
their own schemas. Run `make migrate` before `make migration-check` locally.

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
`NY` / `personal_injury`, `CA` / `employment`, `TX` / `personal_injury`,
`FL` / `housing`, `IL` / `employment`, `NJ` / `family_law`, `PA` / `consumer`,
`MA` / `medical_malpractice`, `GA` / `workers_compensation`, and
`WA` / `immigration`; other pairs remain pending.
Region is uppercased and category lowercased. Inactive firms are not routed to.
`GET /api/leads?limit=50&offset=0` and `GET /api/leads/{id}` enforce plaintiff
ownership, staff firm assignment, or admin access. Submission and initial audit
history are committed atomically. Swagger at `/docs` supports trying these endpoints.
Plaintiff, firm, and admin workflow screens are implemented.

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

Plaintiff, firm, and admin workflow screens are implemented.

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

## Frontend foundation

The client portal now has a dark responsive shell, login/logout, session restoration,
role guards, and routes for `/plaintiff/leads`, `/plaintiff/leads/new`,
`/plaintiff/leads/:leadId`, `/plaintiff/cases`, and `/plaintiff/cases/:caseId`.
Plaintiff screens now load leads and cases, submit inquiries, show progress, and
exchange PDFs.
Staff logins open `/firm/leads`; admins open `/admin/leads`.

The demo bearer token is kept in sessionStorage for refreshes within the current tab;
logout removes it locally (server-side revocation is not implemented). The backend
validates identity and access independently of frontend guards. Expired tokens are
cleared during session restoration; temporary connection failures offer a retry.
The frontend uses the existing Vite `/api` proxy. A future production static host
must serve index.html for frontend routes and proxy `/api` to FastAPI.

From `frontend/`, run `npm ci`, `npm test`, and `npm run build` to verify the foundation.

## Plaintiff workflow

Sign in at `/login` using `plaintiff@example.com` / `demo-password` after seeding.
Use **New lead** to submit an inquiry, then follow it under **Leads**. Region and
category inputs offer demo suggestions while allowing unmatched values for admin
review. Leads show the assigned firm and link to a case after staff acceptance.
**Cases** shows accepted work and its latest progress. Detail pages support PDF
upload, browser preview, and download with authenticated requests. Use Refresh to
see staff/admin changes; live push updates are not implemented.

Lists and documents are paginated. No inquiry title or sequential reference number
is invented: row headings preview the submitted description. Private notes are
never requested or displayed in the plaintiff UI. Requests that return 401 send the
user back to sign-in. Firm staff can accept leads and update progress through the
firm portal. Admins use the admin portal for assignment and history inspection.

Lead responses include a minimal firm summary and nullable case_id. Case responses
include the associated lead; these read relationships do not change the schema.

## Firm workflow

Sign in with `attorney@example.com` or `paralegal@example.com` and `demo-password`
to open the North Legal portal. The `attorney2` and `paralegal2` accounts belong to
South Legal. Both staff roles have the same workflow permissions.

- `/firm/leads`: assigned-firm inbox with search, status, region, and category
  filters. Filters and pagination are stored in the URL. Region/category matching
  uses normalized exact values; search checks name, email, and description.
- `/firm/leads/{id}`: inspect intake and PDFs, then confirm acceptance or decline.
  Acceptance opens the created case. Decline leaves resolution to admins.
- `/firm/cases`: paginated, searchable case list with status filtering.
- `/firm/cases/{id}`: save plaintiff-visible status/progress, add and page through
  firm-private notes, and exchange PDFs using the shared document controls.

Refresh to see updates by other users. A reassigned record returns an inaccessible
state on refresh; later save requests are also checked by the backend. The UI does
not automatically poll for assignment changes. Private notes never appear in the
plaintiff UI and remain owned by the firm that wrote them.

## Admin workflow

Sign in with `admin@example.com` / `demo-password` to open `/admin/leads`.
Search leads and cases across firms, use status/region/category filters on leads,
and use the unmatched/declined shortcuts to find inquiries needing assignment.
Detail pages show intake, PDFs, and case progress where present.

Choose an active firm, review the transfer, and confirm. Assigning an unmatched or
declined lead makes it ready for firm review. Assigning a case moves its lead with
it; existing case progress and documents remain. The firm picker loads all pages
of active firms rather than assuming the first page contains every choice.

Admins can inspect private notes from every authoring firm, with firm/author labels,
but do not receive the staff note-writing form or progress editor. Assignment and
status history shows actor name/email, timestamp, and before/after values. Assignment
changes retain firm UUIDs as the recorded values so firm renames do not rewrite history.

Routes: `/admin/leads`, `/admin/leads/{id}`, `/admin/cases`, `/admin/cases/{id}`.
Refresh to see other users' changes; there is no background polling. Admin screens
use the existing service authorization rules and do not bypass backend checks.

## Mock-aligned UI

All portals use the supplied UI mocks: fixed forest sidebar, cream workspace,
compact tables, status badges, rounded cards, and split detail views. On narrow
screens navigation moves above the workspace and tables scroll within their card.

The admin landing page is `/admin/overview`, which combines cases and leads without
duplicating accepted inquiries. Its firm and attention filters are applied before
pagination. `/admin/activity` shows the cross-system activity log. Reassignment may
include an optional reason, stored with that assignment's audit event.

Case progress timelines use `/api/cases/{id}/progress`, exposing only shared progress
and status updates from saved audit events. Private notes and actor identities are
excluded from this plaintiff-readable endpoint. `/api/admin/work` and
`/api/admin/activity` require an admin account. These changes need no schema migration.

The mock's people, firms, and sample documents are visual examples; the UI renders
actual demo data. Private notes remain case records created after acceptance; an
unaccepted lead has no case-note history to display. Regions/categories still accept
custom input so unmatched inquiries can be demonstrated with the existing routing.

Tests are grouped under `backend/tests/` and `frontend/tests/`. Frontend tests mirror
the app/component/page structure and are included in TypeScript and formatting checks.
