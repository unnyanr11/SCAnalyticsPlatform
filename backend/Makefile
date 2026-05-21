.PHONY: dev build up down logs migrate shell test lint

dev:
	uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

build:
	docker compose build

up:
	docker compose up -d

down:
	docker compose down

logs:
	docker compose logs -f api

migrate:
	alembic upgrade head

migrate-new:
	alembic revision --autogenerate -m "$(msg)"

shell:
	docker compose exec api bash

test:
	pytest -v

lint:
	ruff check app/ && mypy app/
