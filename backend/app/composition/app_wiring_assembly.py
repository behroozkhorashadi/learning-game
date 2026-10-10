"""The backend composition root for new-style features. The only place that reads
settings, creates engines and clients, picks implementations, and calls bind_*/make_*.

The legacy app (app/main.py) calls `assemble_features` to mount these routers on
itself; `assemble_app` builds a standalone app of just the new-style features and is
what the integration test boots.
"""

from datetime import UTC, datetime
from typing import Final
from uuid import uuid4

from fastapi import FastAPI
from sqlalchemy import create_engine

from app.composition.app_settings_assembly import AppSettings
from app.todo.todo_repository_effect import make_sql_todo_repository
from app.todo.todo_routes_effect import bind_todo_routes
from app.todo.todo_schemas_pure import TodoId
from app.todo.todo_service_effect import make_todo_service

TODO_ROUTE_PREFIX: Final = "/api/examples/todos"


def assemble_features(app: FastAPI, settings: AppSettings) -> None:
    if settings.todo_example_enabled:
        connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
        engine = create_engine(settings.database_url, connect_args=connect_args)
        repository = make_sql_todo_repository(engine=engine)
        repository.create_schema()
        service = make_todo_service(
            repository=repository,
            clock=lambda: datetime.now(UTC),
            new_id=lambda: TodoId(uuid4().hex),
        )
        app.include_router(bind_todo_routes(service=service), prefix=TODO_ROUTE_PREFIX)


def assemble_app(settings: AppSettings) -> FastAPI:
    app = FastAPI(title="Adaptive Learning Games API")
    assemble_features(app, settings)
    return app
