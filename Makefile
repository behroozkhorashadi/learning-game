.PHONY: help serve test gen-types gen-audio gen-images gen-game-assets gen-badge-assets frontend install-backend install-frontend

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'

install-backend: ## Create backend/.venv and install backend/requirements.txt
	cd backend && uv venv --python 3.12 .venv && uv pip install --python .venv -r requirements.txt

install-frontend: ## npm install in frontend/ (uses Node version from frontend/.nvmrc)
	cd frontend && . "$$NVM_DIR/nvm.sh" && nvm use && npm install

serve: ## Run the FastAPI server on the LAN (0.0.0.0:8000)
	cd backend && .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

frontend: ## Run the Vite dev server (proxies /api to localhost:8000)
	cd frontend && . "$$NVM_DIR/nvm.sh" && nvm use && npm run dev

test: ## Run the backend pytest suite
	cd backend && .venv/bin/pytest -v

gen-types: ## Regenerate frontend/src/types/generated.ts from the Python models
	cd backend && .venv/bin/python scripts/generate_ts_types.py

gen-audio: ## Regenerate word-bank audio assets
	cd backend && .venv/bin/python scripts/generate_word_audio.py

gen-images: ## Regenerate word-bank image assets
	cd backend && .venv/bin/python scripts/generate_word_images.py

gen-game-assets: ## Regenerate per-game hero/completion-badge assets
	cd backend && .venv/bin/python scripts/generate_game_assets.py

gen-badge-assets: ## Regenerate Accomplishments-screen achievement badge assets
	cd backend && .venv/bin/python scripts/generate_badge_assets.py
