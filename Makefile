.DEFAULT_GOAL := help
SHELL := /bin/bash
UV ?= uv
NPM ?= npm
PYTHON ?= python3
COMPOSE ?= docker compose
TEST_DATABASE_URL ?= postgresql+psycopg://leads:leads@localhost:5432/leads
export TEST_DATABASE_URL
export message

.PHONY: help env install setup dev dev-blank backend frontend db-up db-down db-logs migrate migration migration-check seed test test-backend test-frontend build check

help: ## List available commands
	@awk 'BEGIN {FS = ":.*## "; printf "Run make <target> from the repository root:\n\n"} /^[a-zA-Z_-]+:.*## / {printf "  %-18s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

env: ## Create backend/.env if missing; preserve existing settings
	@test -f backend/.env || cp backend/.env.example backend/.env

install: ## Install locked backend and frontend dependencies
	cd backend && $(UV) sync --locked
	cd frontend && $(NPM) ci

setup: env ## First-time setup: dependencies, Postgres, migration, demo users
	$(MAKE) install
	$(MAKE) db-up
	$(MAKE) migrate
	$(MAKE) seed

dev: env db-up ## Run API + frontend together; Ctrl-C stops both (Postgres stays up)
	$(MAKE) migrate
	$(MAKE) seed
	$(PYTHON) scripts/dev.py

dev-blank: env ## Delete local Postgres data and start servers without migrations or seeds
	$(COMPOSE) down --volumes
	$(COMPOSE) up -d --wait db
	$(PYTHON) scripts/dev.py

backend: env ## Run the API with reload on http://localhost:8000
	cd backend && $(UV) run uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

frontend: ## Run the UI on http://localhost:5173 (fail if port is occupied)
	cd frontend && $(NPM) run dev -- --host 127.0.0.1 --port 5173 --strictPort

db-up: ## Start local Postgres and wait until healthy
	$(COMPOSE) up -d --wait db

db-down: ## Stop local Postgres, preserving its data volume
	$(COMPOSE) down

db-logs: ## Follow Postgres logs
	$(COMPOSE) logs -f db

migrate: env ## Apply committed migrations to the configured database
	cd backend && $(UV) run alembic upgrade head

migration: env ## Generate migration: make migration message="describe change"
	@test -n "$$message" || { echo 'Usage: make migration message="describe change"'; exit 2; }
	cd backend && $(UV) run alembic revision --autogenerate -m "$$message"

migration-check: env ## Check the configured database for model/schema drift
	cd backend && $(UV) run alembic check

seed: env ## Insert missing demo firms, users, and routing rules
	cd backend && $(UV) run python -m app.db.seed

test: ## Run Postgres backend tests and frontend tests
	$(MAKE) test-backend
	$(MAKE) test-frontend

test-backend: db-up ## Test backend using isolated schemas in TEST_DATABASE_URL
	cd backend && $(UV) run pytest -q

test-frontend: ## Run frontend tests once
	cd frontend && $(NPM) test

build: ## Type-check and build the frontend
	cd frontend && $(NPM) run build

check: ## Run both test suites and the frontend type-check/build
	$(MAKE) test
	$(MAKE) build
