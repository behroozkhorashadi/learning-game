# Backend migration: legacy → feature/color layout

67 pre-guardrail files are on `scripts/lint_py/legacy_allowlist.txt`. They keep working
unchanged, but new code can't import them. Don't big-bang rename. **Migrate a module when
you're already changing it and you need it from new-style code.**

## The unit of migration

"This behavior is served by a feature built from `make_*`/`bind_*` with fakes-driven tests."
That forces the real refactor (inject the session/clock/env, split routes from logic) and
nothing more.

## Steps (follow in order)

1. Pick one route group in `app/main.py` (e.g. practice-config). Create `app/<feature>/`:
   `<f>_schemas_pure.py` (move the pydantic/SQLModel request/response models, or copy them
   if legacy still needs them), `<f>_reducers_pure.py` (validation and state transitions,
   with `utcnow()` replaced by a `now` argument), `<f>_ports_pure.py`,
   `<f>_repository_effect.py` (over an injected engine), `<f>_service_effect.py`, and
   `<f>_routes_effect.py`. Copy `app/todo/`.
2. Wire it in `app/composition/app_wiring_assembly.py`. Delete the old handlers from `app/main.py`.
   Keep URLs and response shapes identical. `make gen-api` (OpenAPI → TS) must show no diff for those paths.
3. Move its tests to `tests/<feature>/test_<module>.py` with fakes. Keep the old HTTP-level
   tests in `tests/test_api.py` passing until the new ones cover the same behavior, then delete them.
4. Delete the migrated files' lines from `legacy_allowlist.txt` and both legacy lists in
   `pyproject.toml`, then lower `MAX_LEGACY_FILES`. Run `scripts/preflight.sh`.

## Order (smallest blast radius first)

- [ ] `app/util.py` → inline `utcnow` into assembly as the clock (pilot: simple)
- [ ] practice-config routes + `app/models/practice_config.py` (pilot: coupled to DB)
- [ ] pathfinder completions/maps routes + `app/models/pathfinder.py`
- [ ] `app/admin_auth.py` → `AppSettings.admin_password: SecretStr` + a Depends provider registered in assembly
- [ ] `app/db.py` → engine created in assembly (last; every legacy route depends on it)
- [ ] games, engine, events, services, the remaining routes
