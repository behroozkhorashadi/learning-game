"""The uvicorn entry point (`uvicorn app.main:app`). Everything is built in
app/composition/; see backend/AGENTS.md."""

from app.composition.app_settings_assembly import load_settings
from app.composition.app_wiring_assembly import assemble_app

app = assemble_app(load_settings())
