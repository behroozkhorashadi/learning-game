# Claude Code kickoff prompt

Paste everything below into Claude Code, with `PRD_adaptive_learning_games.md` present in the working directory.

---

We are building an adaptive learning-games platform for my three kids (ages 6, 9, 11), covering math and writing. The full spec is in `PRD_adaptive_learning_games.md`. That document is the source of truth. Read it in full before writing any code or creating any files.

## How I want you to work

1. **Read the PRD first.** Pay special attention to Sections 4 (domain model), 5 (adaptive engine and telemetry), 6 (game-module contract), 9 (architecture, including 9.1 the model-provider layer), 11 (testing), and 16 (next steps).
2. **Confirm the plan before you build.** After reading, restate back to me: the file and module structure you intend to create, the exact type/model definitions and their fields, and the game-module interface signatures. Then stop and wait for my confirmation. Do not write code until I approve the shape. The PRD principle is "the contract drives the shape of everything," so we settle the contract before anything is built on top of it.
3. **Stay strictly inside this task's scope** (defined below). Do not get ahead of the roadmap. If you find yourself wanting to build a real game UI, the adaptive engine logic, the LLM layer, or the parent dashboard, stop; those are later milestones.
4. **When you do build, keep it small and typed.** Type hints everywhere, short pure modules, docstrings that reference the relevant PRD section, no premature abstractions. Run the tests and show me them passing before you consider the task done.

## Stack (from PRD Section 9)

- Backend: Python + FastAPI, async.
- Persistence: SQLite via SQLModel. The SQLModel classes double as the Pydantic schemas: one source of truth for the core entities.
- Core logic (engine, item generators, scoring): pure Python, no web or IO concerns, deterministic under a seeded RNG, tested with pytest.
- Frontend: Vite + React + TypeScript. For this task it is a placeholder shell only, no real game rendering and no visual design (that comes separately from Claude Design).
- Type sync: generate the frontend TypeScript types from the Pydantic/SQLModel models so the two sides cannot drift. Set up the generation step even if the frontend is minimal.

## Non-negotiable design constraints (subtle but load-bearing)

These are the details that are easy to get wrong. Honor all of them.

1. **Thick client over a server of record.** The client owns rendering and the play loop. The Python server owns difficulty selection, persistence, the event log, and (later) writing-only scoring.

2. **The server owns difficulty and level selection. The client never decides difficulty.** The flow is: server tells the client "play game X at config Y," the client runs it and reports results, the server updates the stored level. If level selection leaks into the client, the adaptive engine loses control of the one thing it exists to control. For this task the "engine" can be a trivial selector that reads the stored per-(profile, game) level and defaults to 1; just make sure difficulty selection lives server-side so the real engine can slot in later.

3. **An `Item` is one playable unit of a game at a chosen config.** Depending on the game it may be a single challenge (one word, one equation) or a whole short round. The client owns how it plays out. Do not assume an Item is always a single question.

4. **Home-network threat model: none.** These are my own kids on a LAN. Therefore objective games (Syllable Builder, Equation Builder, Fact Fluency) are scored on the client, which just reports the result. Do not build server-side scoring for objective games. Server-side scoring exists only for open-ended writing, where a model provider grades it, and that is out of scope for this task (define the interface seam, do not implement it).

5. **The result-payload floor is mandatory.** Every result the client posts back is a flexible, per-game envelope that MUST contain a required telemetry core: per-attempt correctness or score, hints used, and timing in ms. This floor is non-negotiable because two consumers depend on it: the real-time difficulty engine and the append-only event log. A lossy result (for example, only a final aggregate score) starves the engagement analysis. Validate on the server that the telemetry core is present and reject payloads that omit it.

6. **The event log is append-only, and metrics derive from it.** Do not mutate state and hope to reconstruct history. Land the `events` table and an append helper in this task (models and write path), even though the analysis and dashboards come much later. Events carry: `event_id`, `timestamp`, `profile_id`, `game_id`, `variant_id`, `session_id`, `event_type`, and a typed `payload`.

7. **Reading support is a per-profile flag, not an age rule.** `Profile` has a `readingSupport` boolean, on by default for the age-6 band but independently settable. (My 6yo reads fluently, so his is off.) Just model the field correctly.

8. **Rules-based, no ML, no auth.** No machine-learning personalization. No accounts or logins in this phase (a parent PIN gate for verification comes later). Keep it simple.

## This task's exact scope

Scaffold the project and define the contract in code. Concretely:

- **Repo scaffold:** a backend (FastAPI + SQLModel + SQLite) and a minimal frontend (Vite + React + TS), with a single command to run the server on the LAN, a single command to run pytest, and the TypeScript-type-generation step wired up. A README with these commands.
- **Core models (SQLModel/Pydantic):** `Profile` (with `readingSupport`, age band, per-skill state), `Skill`, game-module `metadata`, per-(profile, game) `Level`, `Item`, `Attempt` (the flexible envelope plus the required telemetry core), `Event` (append-only, typed payload), `Session`, `Verification`, `Variant`, `Rating`. Some can be minimal, but the fields that carry the constraints above must be right.
- **Game-module interface:** a base class or protocol with `metadata`, `generate_item(level, rng) -> Item` (server, deterministic), and a declared but unimplemented `score_attempt` seam marked writing-only. Note where a client-side renderer would attach; do not build one.
- **One stub game module:** a trivial Syllable Builder that implements `generate_item` deterministically, with difficulty rising monotonically on its primary axis (syllable count) as level rises. Fixed word list is fine.
- **Two FastAPI endpoints:** get-next-item for (profile, game) with the server selecting the level, and post-attempt-result that validates the telemetry core and appends an event.
- **pytest tests:** `generate_item` is deterministic under a fixed seed; difficulty is monotonic on the primary axis across levels; posting an attempt without the telemetry core is rejected; a valid attempt appends exactly one event.
- **Frontend placeholder:** a page that fetches an item and renders it as raw placeholder text, and can post back a hardcoded valid result. No styling, no game interaction.

## Explicitly out of scope for this task

The real adaptive engine logic (promote/hold/support), the model-provider layer and any LLM calls, writing games and rubric scoring, ratings sampling behavior, variant assignment logic, the reward loop, the parent dashboard, audio, and all visual design. Model the fields and interfaces so these have a home, but implement no behavior for them.

## Definition of done

The scaffold runs, the two endpoints work end to end (the placeholder frontend can fetch an item and post a result), the TypeScript types are generated from the Python models, and all pytest tests pass. Show me the test output and a tree of the files you created.
