# Lead management system

React, FastAPI, and PostgreSQL.

## Setup

Requires Docker Compose, GNU Make, Python 3.12+, uv, and Node.js 22 with npm.
On Windows, use WSL.

```sh
make setup
make dev
```

- App: http://localhost:5173
- API docs: http://localhost:8000/docs

`make setup` installs dependencies, starts Postgres, runs migrations, and seeds
accounts and routing rules. It leaves existing `.env` settings and data intact.

Ctrl-C stops the app. `make db-down` stops Postgres without deleting its data.

## Accounts

Password: `demo-password`

| Email | Role | Firm |
| --- | --- | --- |
| `plaintiff@example.com` | Plaintiff | — |
| `plaintiff2@example.com` | Plaintiff | — |
| `attorney@example.com` | Attorney | North Legal |
| `paralegal@example.com` | Paralegal | North Legal |
| `attorney2@example.com` | Attorney | South Legal |
| `paralegal2@example.com` | Paralegal | South Legal |
| `admin@example.com` | Admin | — |

New York / Personal injury routes to North Legal. California / Employment routes
to South Legal. Unmatched leads wait for admin assignment.

## Commands

```sh
make dev-blank  # Delete local Postgres data; no migrations or seeds
make check      # Tests and frontend build
make help       # All commands
```

`make dev-blank` resets only the Compose database. Table-backed endpoints need
`make migrate` afterward; demo sign-in also needs `make seed`. Uploaded PDFs are kept.

[Architecture, development notes, and limitations](docs/architecture.md)
