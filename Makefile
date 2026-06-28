GREEN  := \033[0;32m
YELLOW := \033[0;33m
RED    := \033[0;31m
NC     := \033[0m

BACKEND_DIR  := backend
FRONTEND_DIR := frontend
VENV         := $(BACKEND_DIR)/.venv
PYTHON       := .venv/bin/python3.12
PIP          := .venv/bin/pip
ALEMBIC      := .venv/bin/alembic
UVICORN      := .venv/bin/uvicorn

DB_NAME      := notica
DB_USER      := notica
DB_PASS      := changeme
DB_PORT      := 5432
DB_CONTAINER := notica-dev-db
DATABASE_URL := postgresql+asyncpg://$(DB_USER):$(DB_PASS)@localhost:$(DB_PORT)/$(DB_NAME)

PROJECT        := notica
IMAGE_BACKEND  := notica-backend
IMAGE_FRONTEND := notica-frontend

# make build REGISTRY=myregistry [TAG=1.0.0]
REGISTRY ?= yourname
TAG      ?= latest

.DEFAULT_GOAL := help
.PHONY: help install install-backend install-frontend \
        db-up db-down db-shell db-reset \
        migrate migrate-down migrate-status \
        dev-backend dev-frontend \
        build \
        up down restart logs logs-backend status \
        typecheck

# ─── Help ──────────────────────────────────────────────────────────────────────

help:
	@echo ""
	@echo "  Notica — development commands"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  $(GREEN)%-20s$(NC) %s\n", $$1, $$2}'
	@echo ""

# ─── Install ───────────────────────────────────────────────────────────────────

install: install-backend install-frontend ## Install all dependencies

install-backend: ## Create venv + install Python dependencies
	@echo "$(YELLOW)Setting up Python venv...$(NC)"
	python3.12 -m venv $(VENV)
	$(PIP) install --upgrade pip --quiet
	$(PIP) install -r $(BACKEND_DIR)/requirements.txt --quiet
	@echo "$(GREEN)Backend dependencies installed$(NC)"

install-frontend: ## Install Node dependencies
	@echo "$(YELLOW)Installing frontend dependencies...$(NC)"
	cd $(FRONTEND_DIR) && npm install --silent
	@echo "$(GREEN)Frontend dependencies installed$(NC)"

# ─── Database ──────────────────────────────────────────────────────────────────

db-up: ## Start local PostgreSQL container
	@docker start $(DB_CONTAINER) 2>/dev/null || \
		docker run -d \
			--name $(DB_CONTAINER) \
			-e POSTGRES_DB=$(DB_NAME) \
			-e POSTGRES_USER=$(DB_USER) \
			-e POSTGRES_PASSWORD=$(DB_PASS) \
			-p $(DB_PORT):5432 \
			postgres:16-alpine
	@echo "$(GREEN)PostgreSQL running on localhost:$(DB_PORT)$(NC)"

db-down: ## Stop local PostgreSQL container
	@docker stop $(DB_CONTAINER) 2>/dev/null && \
		echo "$(YELLOW)PostgreSQL stopped$(NC)" || \
		echo "$(YELLOW)PostgreSQL was not running$(NC)"

db-shell: ## Open psql into the dev database
	docker exec -it $(DB_CONTAINER) psql -U $(DB_USER) -d $(DB_NAME)

db-reset: ## Drop and recreate dev database then migrate (DESTRUCTIVE)
	@echo "$(RED)Dropping database $(DB_NAME)...$(NC)"
	docker exec $(DB_CONTAINER) psql -U $(DB_USER) -c "DROP DATABASE IF EXISTS $(DB_NAME);"
	docker exec $(DB_CONTAINER) psql -U $(DB_USER) -c "CREATE DATABASE $(DB_NAME);"
	$(MAKE) migrate
	@echo "$(GREEN)Database reset complete$(NC)"

# ─── Migrations ────────────────────────────────────────────────────────────────

migrate: ## Run Alembic migrations (requires db-up)
	cd $(BACKEND_DIR) && DATABASE_URL=$(DATABASE_URL) $(ALEMBIC) upgrade head

migrate-down: ## Roll back last Alembic migration
	cd $(BACKEND_DIR) && DATABASE_URL=$(DATABASE_URL) $(ALEMBIC) downgrade -1

migrate-status: ## Show current migration state
	cd $(BACKEND_DIR) && DATABASE_URL=$(DATABASE_URL) $(ALEMBIC) current

# ─── Dev Servers ───────────────────────────────────────────────────────────────

dev-backend: ## Start FastAPI with hot reload (port 8000) — config từ backend/.env.local
	cd $(BACKEND_DIR) && $(UVICORN) main:app --reload --host 0.0.0.0 --port 8000 --log-level info

dev-frontend: ## Start Vite dev server (port 5173)
	cd $(FRONTEND_DIR) && npm run dev

# ─── Build ────────────────────────────────────────────────────────────────────
# make build REGISTRY=myuser TAG=1.0.0
# Sau đó tự push: docker push myuser/notica-backend:1.0.0

build: ## Build images (make build REGISTRY=myregistry)
	@[ "$(REGISTRY)" != "yourname" ] || (echo "$(RED)Set REGISTRY: make build REGISTRY=myregistry$(NC)" && exit 1)
	docker build -t $(REGISTRY)/$(PROJECT)/$(IMAGE_BACKEND):$(TAG)  $(BACKEND_DIR)
	docker build -t $(REGISTRY)/$(PROJECT)/$(IMAGE_FRONTEND):$(TAG) $(FRONTEND_DIR)
	@echo "$(GREEN)Built:$(NC)"
	@echo "  $(REGISTRY)/$(PROJECT)/$(IMAGE_BACKEND):$(TAG)"
	@echo "  $(REGISTRY)/$(PROJECT)/$(IMAGE_FRONTEND):$(TAG)"


up: ## Start all services in production mode
	@[ -f .env ] || (echo "$(RED)Missing .env — copy .env.example and fill in values$(NC)" && exit 1)
	docker compose up -d
	@echo "$(GREEN)Notica is up$(NC)"

down: ## Stop all services
	docker compose down

restart: ## Restart all services
	docker compose restart

logs: ## Follow logs from all services
	docker compose logs -f

logs-backend: ## Follow backend logs only
	docker compose logs -f backend

status: ## Show service health
	docker compose ps

# ─── Code Quality ──────────────────────────────────────────────────────────────

typecheck: ## Run TypeScript type check
	cd $(FRONTEND_DIR) && npm run build -- --mode development 2>&1 | head -30
