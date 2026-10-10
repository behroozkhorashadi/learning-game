import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.todo.todo_routes_effect import bind_todo_routes
from app.todo.todo_service_effect import make_todo_service
from tests.todo.todo_fakes import InMemoryTodoRepository, ManualClock, SequentialIds


@pytest.fixture
def client() -> httpx.Client:
    service = make_todo_service(repository=InMemoryTodoRepository(), clock=ManualClock(), new_id=SequentialIds())
    app = FastAPI()
    app.include_router(bind_todo_routes(service=service), prefix="/todos")
    # Typed as its httpx base class: Starlette's own TestClient annotations don't resolve under pyright.
    return TestClient(app)


def test_post_then_get(client: httpx.Client) -> None:
    created = client.post("/todos", json={"title": " walk "})
    assert created.status_code == 201
    assert created.json() == {"id": "todo-1", "title": "walk", "done": False}
    assert client.get("/todos").json() == [{"id": "todo-1", "title": "walk", "done": False}]


def test_patch_marks_done(client: httpx.Client) -> None:
    client.post("/todos", json={"title": "walk"})
    assert client.patch("/todos/todo-1", json={"done": True}).json()["done"] is True


def test_patch_missing_is_404(client: httpx.Client) -> None:
    assert client.patch("/todos/nope", json={"done": True}).status_code == 404


def test_put_replaces_the_list(client: httpx.Client) -> None:
    client.post("/todos", json={"title": "old"})
    body = [{"id": "b", "title": "b", "done": True}, {"id": "a", "title": "a", "done": False}]
    assert client.put("/todos", json=body).json() == body
    assert client.get("/todos").json() == body


@pytest.mark.parametrize(
    "body",
    [
        [{"id": "a", "title": "x", "done": False}, {"id": "a", "title": "y", "done": False}],
        [{"id": "a", "title": "", "done": False}],
        [{"id": "a", "title": "x"}],
        {"id": "a", "title": "x", "done": False},
    ],
)
def test_put_rejects_malformed_lists(client: httpx.Client, body: object) -> None:
    assert client.put("/todos", json=body).status_code == 422
