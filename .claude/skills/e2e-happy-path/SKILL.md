---
name: e2e-happy-path
description: Run the on-demand Playwright happy-path e2e suite (profiles, passwords, saved pictures, admin) against an isolated temp backend, then visually review the key-screen screenshots and report. Use when asked to run the e2e / happy-path / browser tests, smoke-test the app end to end, or check the screens still look right. Not part of CI.
---

# E2E happy-path run

The suite lives in `frontend/e2e/` and is configured by
`frontend/playwright.config.ts`. It is deliberately **not** in CI or
`npm test` — it's run every so often, on request.

## What isolates it (don't change these to "make it work")

- Its own backend on **127.0.0.1:8100** (`frontend/e2e/start-backend.sh`) with a
  database and picture folder in `$TMPDIR/learning-game-e2e`, wiped at the
  start of each run. The real `backend/learning_game.db` is never opened.
- Its own Vite server on **127.0.0.1:5174**, proxying to 8100.
- `reuseExistingServer: false`: if 8100/5174 are busy the run fails instead
  of testing some other server. Never point the suite at 8000/5173.
- Test admin password `e2e-admin-password` (`frontend/e2e/fixtures.ts`). Never
  use the real one from `backend/.env`.
- `OPENAI_API_KEY` is blanked, so nothing can call OpenAI; remixes get a 503.
- It drives the installed Google Chrome (`channel: 'chrome'`), so there's no
  Playwright browser download.

## Run it

```sh
cd frontend && npm run e2e        # or: make e2e (from the repo root)
```

Needs Node 20+ (`frontend/.nvmrc`). If the default `node` is older, prefix the
command with `PATH=~/.nvm/versions/node/v20.20.2/bin:$PATH` (or whichever
`~/.nvm/versions/node/v2*` exists). A full run takes about 30-40 seconds; the
backend's own log lines are prefixed `[WebServer]` and can be filtered out.

To run a single file: `npx playwright test e2e/passwords.spec.ts`.

## After the run

1. **Results.** Report passed/failed counts. For each failure, read its
   error, then look at `frontend/e2e-results/<test>/test-failed-1.png` (and
   the trace, `npx playwright show-trace <path>/trace.zip`, if needed) and
   say whether it's an app bug or a test that needs updating. Don't
   "fix" a failing test by loosening it without saying so.
2. **Screens.** Read every PNG in `frontend/e2e-screens/` (named
   `NN-what-it-shows.png`) and check: nothing overlaps or is cut off, text is
   readable, the expected elements are there (lock icon on protected
   profiles, edit pencils, error messages in red, the selected picture
   outlined), and nothing looks broken. The "Dev screens" pill in the corner
   is a dev-server-only button — ignore it.
   Animal-avatar profiles show their emoji (🦊, 🦉, …) in the avatar circle;
   an empty circle there is a regression.
3. **Report** in a few lines: pass/fail, anything that looks off in the
   screenshots (name the file), and suggested fixes. Don't fix app code
   unless asked.

## Adding a scenario

Keep each test a fast happy path (a few seconds), so the whole run stays
under a minute:

- Use the helpers in `e2e/fixtures.ts` (`createProfile`, `switchPlayer`,
  `playButton`, `enterPassword`, `uniqueName`, `snap`). Tests share one temp
  DB per run, so always use `uniqueName(...)`.
- Prefer seeding through the API (`request.post('/api/...')`) over long UI
  setup, the way `pictures.spec.ts` seeds saved pictures.
- Call `snap(page, 'NN-name')` on any new screen worth eyeballing.
- Out of scope: the zombie game / anything 3D or timing-heavy, the camera,
  and real OpenAI remixes (slow and costs money).
- Every test fails automatically on an uncaught page error or `console.error`
  (the `pageErrors` fixture).
