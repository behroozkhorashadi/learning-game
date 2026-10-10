"""HTTP surface for the todo example. Thin: FastAPI parses the body into a pydantic
model, the handler calls the injected service, and the return type is the response
model. Mounted by assembly under /api/examples/todos."""

from fastapi import APIRouter, HTTPException, status

from app.todo.todo_ports_pure import DuplicateTodoIdError, TodoNotFoundError, TodoService
from app.todo.todo_schemas_pure import Todo, TodoCreate, TodoId, TodoUpdate


def bind_todo_routes(*, service: TodoService) -> APIRouter:
    router = APIRouter(tags=["examples"])

    @router.get("")
    def list_todos() -> list[Todo]:
        return list(service.list_todos())

    @router.post("", status_code=status.HTTP_201_CREATED)
    def add_todo(draft: TodoCreate) -> Todo:
        return service.add_todo(draft)

    @router.put("")
    def replace_todos(todos: list[Todo]) -> list[Todo]:
        try:
            return list(service.replace_todos(todos))
        except DuplicateTodoIdError as error:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, str(error)) from error

    @router.patch("/{todo_id}")
    def update_todo(todo_id: str, change: TodoUpdate) -> Todo:
        try:
            return service.update_todo(TodoId(todo_id), change)
        except TodoNotFoundError as error:
            raise HTTPException(status.HTTP_404_NOT_FOUND, str(error)) from error

    return router
