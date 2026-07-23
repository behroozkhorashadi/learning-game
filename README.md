# Adaptive Learning Games — scaffold

Full spec: `PRD_adaptive_learning_games.md`. This is the M0-adjacent scaffold from
PRD §16 steps 2–3: the repo, toolchain, and the game-module contract in code —
no real engine, no LLM layer, no game UI yet.

## Setup (one-time)

```
make install-backend    # creates backend/.venv, installs backend/requirements.txt
make install-frontend   # npm install in frontend/
```

## Commands

```
make serve       # run the FastAPI server on the LAN (0.0.0.0:8000)
make test        # run the backend pytest suite
make gen-types   # regenerate frontend/src/types/generated.ts from the Python models
make frontend    # run the Vite dev server (proxies /api to localhost:8000)
```

Run `make serve` and `make frontend` in separate terminals, then open the Vite
dev server URL. The placeholder page fetches a Syllable Builder item and can
post back a hardcoded valid result.

Re-run `make gen-types` any time a model in `backend/app/models/` changes —
it is not run automatically.

## What's here

- **`backend/app/models/`** — SQLModel/Pydantic definitions for every core
  entity in PRD §4: `Profile`, `Skill`, `SkillState`, `GameMetadata`, `Level`,
  `Variant`, `Item`, `TelemetryCore`/`AttemptCreate`/`Attempt`/`AttemptRead`,
  `Event`, `PlaySession`, `Verification`, `Rating`.
- **`backend/app/games/`** — the game-module contract (`GameModule` in
  `base.py`), a registry, and one stub module (`SyllableBuilderGame`) with a
  fixed word bank and deterministic, monotonically-harder generation.
- **`backend/app/engine/level_selector.py`** — a trivial stand-in for Loop A:
  reads the stored per-(profile, game) level, defaulting to 1. The real
  promote/hold/support engine (PRD §5.1) is a later milestone; this only
  guarantees difficulty selection lives server-side.
- **`backend/app/events/log.py`** — the only way an `Event` row gets written
  (append-only, PRD §5.3).
- **`backend/app/main.py`** — the two endpoints:
  - `GET /api/items/next?profile_id=&game_id=` — server picks the level,
    generates an `Item`, logs `item_shown`.
  - `POST /api/attempts` — validates the telemetry core (rejects payloads
    missing it), persists the `Attempt`, logs `attempt`.
- **`backend/scripts/generate_ts_types.py`** — walks the Pydantic/SQLModel
  models and emits `frontend/src/types/generated.ts`, so the two sides can't
  drift (PRD §9).
- **`backend/tests/`** — pytest: generation determinism, monotonic difficulty,
  telemetry-core rejection, exactly-one-event-per-attempt.
- **`frontend/`** — Vite + React + TS placeholder shell. Fetches an item,
  renders it as raw JSON, and can POST a hardcoded valid attempt. No styling,
  no real game rendering (that's a Claude Design + later-milestone concern).

## Explicitly not built here

The real adaptive engine (promote/hold/support), the model-provider/LLM layer,
writing games and rubric scoring, ratings sampling, variant assignment logic,
the reward loop, the parent dashboard, audio, and all visual design. Fields and
interfaces exist for these (e.g. `GameModule.score_attempt`, `Variant`,
`Rating`) but carry no behavior yet — see PRD §16 for the intended order.
