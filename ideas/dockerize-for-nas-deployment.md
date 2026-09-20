# Dockerize the app for QNAP NAS deployment

**Status:** idea

## Summary

Package the FastAPI backend and Vite/React frontend as Docker images so the
app can run persistently on a QNAP TS-264 NAS via Container Station, instead
of only via `make serve` / `make frontend` on a dev machine.

## Context

The user has a QNAP TS-264-8G-US (Celeron quad-core, 8GB RAM, QTS with
Container Station and Virtualization Station available). The current stack —
FastAPI + SQLModel/SQLite backend, Vite + React frontend — is lightweight and
well within that hardware's capability. The blocker isn't resources, it's that
the repo currently only has dev-mode run paths (`make serve` runs uvicorn
with `--reload`; `make frontend` runs the Vite dev server). There's no
production build/serve path or container packaging yet.

Per the README, this is still an early scaffold (PRD_adaptive_learning_games.md)
with no LLM/model-provider layer wired in — deployment only needs to cover
what exists today (FastAPI API + static asset serving + SQLite), not any
future external-API-calling component.

The backend also now refuses to start without `ADMIN_PASSWORD` set (gates the
admin screen's edit/remove-player actions — see `backend/app/admin_auth.py`).
Today it's read from `backend/.env` via `load_dotenv()`
(`backend/app/__init__.py`), which is gitignored and won't be baked into a
Docker image — the container needs its own way to receive it (and
`OPENAI_API_KEY`, same story), e.g. `docker run --env-file` / a `.env` +
`env_file:` line in compose, or Container Station's own environment-variable
fields. Don't hardcode either value in the Dockerfile or commit a real `.env`
into the image.

## Scope

In scope:
- `Dockerfile` for the backend: installs `backend/requirements.txt`, runs
  uvicorn without `--reload` (e.g. via a production ASGI runner, not
  necessarily gunicorn — keep it simple for this traffic level).
- A way to serve the built frontend (`frontend/npm run build` → static
  files). Decide between (a) FastAPI serving the built frontend as static
  files itself, or (b) a small nginx container in front. Note:
  `backend/app/main.py` already mounts `/static` for generated
  audio/image assets — that mount is unrelated to the frontend build and
  shouldn't be reused/confused with it.
- `docker-compose.yml` wiring backend + frontend (and a volume for the
  SQLite DB file so data survives container recreation).
- Notes on exposing the LAN port from Container Station and on QNAP-specific
  quirks (e.g. default bridge networking, volume paths under `/share`).

Out of scope:
- Any HTTPS/reverse-proxy setup beyond what's needed for LAN access — still
  no player accounts (PRD non-goal). The admin screen's `ADMIN_PASSWORD` gate
  (see above) already exists and needs to keep working, but adding to or
  hardening it further is out of scope here.
- CI/CD or automated image publishing — build/push manually for now.
- Anything related to the future LLM/model-provider layer.

## Starter instructions for Claude

1. Read `Makefile`, `backend/requirements.txt`, `backend/app/main.py`, and
   `frontend/package.json` to confirm the current run/build commands are
   still accurate (they may have changed since this idea was written).
2. Check whether `backend/app/main.py` seeds a SQLite file path via
   `backend/app/db.py` — that path needs to map to a compose volume so data
   isn't lost on container rebuild.
3. Confirm `ADMIN_PASSWORD` (and `OPENAI_API_KEY`) reach the container as
   env vars — the app raises at startup if `ADMIN_PASSWORD` is missing (see
   `backend/app/admin_auth.py`), so a container missing it won't come up at
   all. Test this explicitly with `docker compose up` before calling it done.
4. Write `backend/Dockerfile` (multi-stage not needed — it's a small pure-Python
   app) and confirm it serves on `0.0.0.0:8000` without `--reload`.
5. Decide frontend serving approach and ask the user if unclear: FastAPI
   serving the Vite `dist/` as static files (simpler, one container) vs. a
   separate nginx container (cleaner separation, one more moving part). Default
   recommendation: have FastAPI serve `dist/` — matches the single-NAS,
   low-traffic use case and avoids a second container to maintain.
6. Write `docker-compose.yml` at repo root, with a named volume for the
   SQLite DB.
7. Test locally with `docker compose up --build` before writing any
   QNAP-specific instructions.
8. Add a short "Deploying to QNAP Container Station" section to `README.md`
   (or a new `ideas/`-adjacent doc if the user prefers) covering: importing
   the compose file in Container Station, exposing the port, where
   persistent volumes land under QNAP's `/share` filesystem, and how to set
   `ADMIN_PASSWORD`/`OPENAI_API_KEY` there (Container Station's "Environment"
   tab when creating the container, or an env file under `/share` referenced
   from the compose file — either way, note it's a one-time manual step per
   container, not something baked into the image).
