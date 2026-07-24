.PHONY: serve test gen-types gen-audio gen-images gen-game-assets frontend install-backend install-frontend

install-backend:
	cd backend && python3.12 -m venv .venv && .venv/bin/pip install -r requirements.txt

install-frontend:
	cd frontend && npm install

serve:
	cd backend && .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

test:
	cd backend && .venv/bin/pytest -v

gen-types:
	cd backend && .venv/bin/python scripts/generate_ts_types.py

gen-audio:
	cd backend && .venv/bin/python scripts/generate_word_audio.py

gen-images:
	cd backend && .venv/bin/python scripts/generate_word_images.py

gen-game-assets:
	cd backend && .venv/bin/python scripts/generate_game_assets.py

frontend:
	cd frontend && npm run dev
