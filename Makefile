.PHONY: help serve test e2e gen-types gen-api check-api check-docs gen-audio gen-images gen-game-assets gen-badge-assets frontend install-backend install-frontend install-hooks dev preflight preflight-backend preflight-frontend

# Use frontend/.nvmrc's Node when nvm is available (CI sets Node up itself).
NODE_ENV = if [ -s "$$NVM_DIR/nvm.sh" ]; then . "$$NVM_DIR/nvm.sh" && nvm use >/dev/null; fi

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'

install-backend: ## Create backend/.venv with runtime + dev tooling (ruff, pyright, import-linter)
	cd backend && uv venv --python 3.12 .venv && uv pip install --python .venv -r requirements.txt -r requirements-dev.txt

install-frontend: ## npm install in frontend/ + Playwright's Chromium (Node version from frontend/.nvmrc)
	cd frontend && . "$$NVM_DIR/nvm.sh" && nvm install && npm install && npx playwright install chromium

install-hooks: ## Install the pre-commit hook (lint on staged files only; CI runs the full preflight)
	git config core.hooksPath .githooks

dev: ## Run backend (:8000) + frontend (Vite) together; Ctrl-C stops both
	@trap 'kill 0' INT TERM EXIT; $(MAKE) --no-print-directory serve & $(MAKE) --no-print-directory frontend & wait

preflight: preflight-backend preflight-frontend check-api check-docs ## Every check CI runs: backend, frontend, API contract, diagrams

preflight-backend: ## Backend: ruff, pyright strict, import-linter, AST rules, cycles, pytest
	backend/scripts/preflight.sh

preflight-frontend: ## Frontend: typecheck, lint, cycles, lint-rule tests, unit tests, storybook browser tests
	cd frontend && $(NODE_ENV) && npm run preflight

serve: ## Run the FastAPI server on the LAN (0.0.0.0:8000)
	cd backend && .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

frontend: ## Run the Vite dev server (proxies /api to localhost:8000)
	cd frontend && . "$$NVM_DIR/nvm.sh" && nvm use && npm run dev

test: ## Run the backend pytest suite (make preflight runs everything)
	cd backend && .venv/bin/pytest -v

e2e: ## Run the on-demand Playwright happy-path suite (own temp DB + ports 8100/5174; not in CI)
	cd frontend && . "$$NVM_DIR/nvm.sh" && nvm use && npm run e2e

gen-api: ## Regenerate frontend/src/api/ (OpenAPI JSON + TS types) from the backend
	cd frontend && $(NODE_ENV) && scripts/gen_api.sh

check-docs: ## Fail if a feature folder isn't drawn in docs/architecture/ or the diagram page is stale
	python3 docs/architecture/check_coverage.py
	python3 docs/architecture/build.py --check
	cd docs/architecture && ../../backend/.venv/bin/pytest -q -p no:cacheprovider test_check_coverage.py

check-api: ## Fail if frontend/src/api/ doesn't match the backend's OpenAPI schema
	cd frontend && $(NODE_ENV) && scripts/gen_api.sh --check

gen-types: ## (legacy) Regenerate frontend/src/types/generated.ts from the Python models
	cd backend && .venv/bin/python -m scripts.generate_ts_types

gen-audio: ## Regenerate word-bank audio assets
	cd backend && .venv/bin/python -m scripts.generate_word_audio

gen-images: ## Regenerate word-bank image assets
	cd backend && .venv/bin/python -m scripts.generate_word_images

gen-game-assets: ## Regenerate per-game hero/completion-badge assets
	cd backend && .venv/bin/python -m scripts.generate_game_assets

gen-badge-assets: ## Regenerate Accomplishments-screen achievement badge assets
	cd backend && .venv/bin/python -m scripts.generate_badge_assets
