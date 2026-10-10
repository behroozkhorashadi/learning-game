# app/composition — the backend composition root

The only place allowed to:
- read configuration: `AppSettings` in `app_settings_assembly.py` (pydantic-settings, read once via `load_settings()`);
- read feature flags (fields on `AppSettings`) and act on them: mount or skip a router, pick an implementation;
- create engines and HTTP clients, choose clocks and id factories (`datetime.now`, `uuid4` are allowed here and nowhere else);
- call `bind_*` / `make_*` factories, always inside an `assemble_*` function, never at module scope.

Nothing imports this package except `app/main.py` (the legacy uvicorn entry, which calls
`assemble_features(app, load_settings())`) and tests. `lint-imports` enforces that.

Adding a feature:
1. Build it in `app/<feature>/` by copying `app/todo/`.
2. In `app_wiring_assembly.py`, inside `assemble_features`, construct its capabilities, call
   its `make_*`/`bind_*`, and `app.include_router(..., prefix=...)`. If it's behind a flag,
   add a `bool` field to `AppSettings` and check it here.
3. Extend `tests/composition/test_app_wiring_assembly.py` so the real graph serves the feature.
4. Add the package to the bottom layer of the `layers` contract in `backend/pyproject.toml`.

Keep this layer boring: construction and wiring only. No business logic, no request
handling. If a lambda here grows beyond one expression, it's a missing effect module.
