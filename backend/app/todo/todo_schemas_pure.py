"""Todo data shapes. `Todo` is the wire contract the frontend worked example
(frontend/src/examples/todo/) parses at its door; `TodoRecord` is what the
repository stores."""

from typing import Annotated, NewType

from pydantic import AwareDatetime, BaseModel, ConfigDict, StringConstraints

TodoId = NewType("TodoId", str)
TodoTitle = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]


class Todo(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    id: Annotated[str, StringConstraints(min_length=1, max_length=64)]
    title: TodoTitle
    done: bool


class TodoCreate(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    title: TodoTitle


class TodoUpdate(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    done: bool


class TodoRecord(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    id: TodoId
    title: TodoTitle
    done: bool
    position: int
    created_at: AwareDatetime
