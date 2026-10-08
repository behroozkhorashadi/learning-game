# Figma Make backend setup

The frontend requires the FastAPI backend for `/api/*` requests. The Make
development scripts now install and start that backend alongside Vite.

The backend requires `ADMIN_PASSWORD` and refuses to start without it, so the
preview won't come up until it is set as a Figma Make environment secret. It
gates the admin-only operations (profile edit/remove).

Do not commit the password or add it to a tracked file. The secret must be set even
if you only use the profile picker and games.
