# docs/architecture — the architecture diagrams

Three Mermaid sources, one generated page:

| file | shows |
|---|---|
| `1-system.mmd` | what runs where: browser, Vite, FastAPI, SQLite, OpenAI, tooling, guardrails, CI |
| `2-backend.mmd` | backend: the `app/main.py` entry, `app/composition/`, and every feature folder with the ports between them |
| `3-frontend.mmd` | frontend: the `main/` shell and entry, and every `src/<feature>/` folder with the dependencies between them |
| `learning-game-architecture.html` | **generated** by `build.py` from the three sources plus their captions. Never edit by hand |

## Enforced (fails `make check-docs`, part of `make preflight` and CI)

- **Every feature folder is drawn.** Each directory with code under `frontend/src/` must
  appear in `3-frontend.mmd`, and each package under `backend/app/` in `2-backend.mmd`, as
  `<name>/`, `src/<name>`, or `app/<name>` (`check_coverage.py`).
- **The page is fresh.** `learning-game-architecture.html` must equal what `build.py`
  produces from the current sources (`build.py --check`).

## Update the diagrams in the same PR when you…

The check only sees folders. These need you:

- **add a feature folder:** add a node labelled `<name>/`, with arrows to what it depends on and from what uses it;
- **add or change a data flow** between features, or between the frontend and an `/api` route group (new endpoint group, a screen that now goes through `src/api/` instead of raw `fetch`);
- **add an external service** (another API, a queue, storage), or change what runs where (a new process, port, or proxy);
- **change the guardrails or CI** (a new job, a new check, a new generator);
- **delete a feature:** remove its node, so the diagram doesn't promise code that's gone.

Small internal changes (a new file inside an existing feature, a refactor that keeps the
same dependencies) don't need a diagram change.

## How

```
edit docs/architecture/<n>-*.mmd    # one node per feature folder, arrows for what it depends on
python3 docs/architecture/build.py   # regenerates the page; update a caption in build.py's SECTIONS if the story changed
make check-docs                      # coverage + freshness + the checker's own tests
```

Open `learning-game-architecture.html` in a browser to check the diagram renders (a
syntax error shows "Diagram failed to render" in its plate). In labels, write `<` and `>`
as `&lt;` / `&gt;`. Keep labels short; the page has pan and zoom for detail.
