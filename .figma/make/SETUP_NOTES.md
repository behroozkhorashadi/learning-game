# Figma Make backend setup

The frontend requires the FastAPI backend for `/api/*` requests. The Make
development scripts now install and start that backend alongside Vite.

The backend intentionally refuses to start unless `ADMIN_PASSWORD` is set.
Configure `ADMIN_PASSWORD` as a Figma Make environment secret, then rerun:

```sh
figma make verify-bootstrap
```

Do not commit the password or add it to a tracked file.

Last verification failure: `.figma/make/dev` exited before ready because
`ADMIN_PASSWORD` was not present in the environment.
