.PHONY: serve test gen-types frontend install-backend install-frontend

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

frontend:
	cd frontend && npm run dev
