# src/api — HTTP adapters and the generated contract

- `openapi.json` and `openapi_schema.pure.lib.ts` are **generated**: `make gen-api` (or
  `npm run gen:api`) exports the FastAPI schema and runs `openapi-typescript`. Never edit
  them by hand. CI runs `npm run check:api` and fails if they differ from the backend.
- One adapter per resource: `<resource>_api.effect.lib.ts` with
  `bind<Resource>Api({ fetch, baseUrl })`. `fetch` is the narrow `HttpFetch` type, never the
  global. Assembly passes the real one; tests pass a fake.
- **Parse at the door.** Each adapter has a zod schema tied to the generated type with
  `satisfies z.ZodType<components['schemas']['X']>`, so a backend change is a compile error
  here. Parse every response (`safeParse`, then throw a descriptive error on mismatch). The
  generated types are the server's claim; zod is the check.
- Non-2xx responses throw `Error` with the method, path, and status. Callers (operations)
  turn that into a `failed(message)` state.
- Return the adapter's own record types (`TodoRecord`). Features stay structurally
  compatible with them; `src/api` never imports a feature.
- Adapters expose plain arrow-function properties, so a feature can take exactly one
  (`{ replaceAll: api.replaceAll }`) without `unbound-method` trouble.
