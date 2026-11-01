# Lead management system

Initial React/TypeScript + FastAPI scaffold. Product workflows, authentication,
PDF endpoints, and domain tables are not implemented yet.

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
No tables are created at startup. Alembic is included as a dependency; its
migration environment and first revision should be added with the domain schema.

PDF storage is planned as a private local directory (configured by
`PDF_STORAGE_PATH`) with document metadata in Postgres. Upload/download endpoints
will enforce authorization. No storage implementation exists yet.

## Checks

```sh
cd frontend
npm run build
```

Stop Postgres with `docker compose down`; the data volume remains.
`docker compose down -v` deletes the local database volume.
