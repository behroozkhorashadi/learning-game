# src/query — the server-state seam

Server state (anything the backend owns) goes through `useQuery(load)` from
`use_query.pure.hook.ts`. It returns a `QueryState<T>` (`loading | loaded | failed`,
from `query_state.pure.lib.ts`) that views render by switching on `kind`.

- `load` is an injected capability, usually an API adapter method (`api.list`) handed
  to the feature's `bindX({ ... })`. It must be **stable**: take it from the bind
  closure, never an inline arrow in render, or the query re-runs on every render.
- The hook owns the stale-result policy: a result never lands on an unmounted
  component.
- **Don't copy query data into `useState`.** It has one writer, the query. If a screen
  needs to edit server data, the edit is a command (an adapter method) followed by a
  re-read, not a local mirror.
- Views take a `QueryState` as a prop (see `profiles/profile_picker.pure.ui.tsx`), so
  stories and tests render every state with `LOADING`, `loaded(data)`, and `failed(msg)`.
- **Re-read after a mutation** with `useReloadableQuery(load)` → `{ state, reload }`
  (`admin/admin_panel.effect.ui.tsx`): call the adapter's command, then `reload()`. The
  last data stays on screen until the new result lands; only the latest run lands.
- Caching and cross-screen invalidation would live here. Nothing needs them yet, so
  they don't exist. Add them when a second screen needs the same data.
