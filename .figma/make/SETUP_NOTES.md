# Figma Make backend setup

The frontend requires the FastAPI backend for `/api/*` requests. The Make
development scripts now install and start that backend alongside Vite.

The backend can run without `ADMIN_PASSWORD`, but admin-only operations remain
unavailable until it is configured as a Figma Make environment secret.

Do not commit the password or add it to a tracked file. The profile picker and
games do not require this secret.
