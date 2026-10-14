"""HTTP surface for parents: the list the picker shows, create, unlock, the admin-only
delete, and the family overview and per-kid report behind the parent's password. Thin:
parse, call the injected service, map domain errors to status codes."""

from typing import Annotated

from fastapi import APIRouter, Header, HTTPException, Query, status

from app.parents.parents_ports_pure import (
    InvalidParentError,
    KidNotLinkedError,
    NotAdminError,
    ParentNotFoundError,
    ParentsService,
    WrongParentPasswordError,
)
from app.parents.parents_schemas_pure import KidReport, KidSummary, ParentCreate, ParentRead, ParentUnlockRequest

PasswordHeader = Annotated[str | None, Header()]
DEFAULT_REPORT_DAYS = 30

DomainError = (ParentNotFoundError, KidNotLinkedError, WrongParentPasswordError, NotAdminError, InvalidParentError)


def _http_error(error: Exception) -> HTTPException:
    if isinstance(error, ParentNotFoundError | KidNotLinkedError):
        return HTTPException(status.HTTP_404_NOT_FOUND, str(error))
    if isinstance(error, WrongParentPasswordError | NotAdminError):
        return HTTPException(status.HTTP_401_UNAUTHORIZED, str(error))
    return HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, str(error))


def bind_parents_routes(*, service: ParentsService) -> APIRouter:
    router = APIRouter()

    @router.get("/api/parents", response_model=list[ParentRead])
    def list_parents() -> list[ParentRead]:
        """The grown-ups row on the profile picker, and the kid profile's
        "Parent" dropdown. No auth: names only."""
        return list(service.list_parents())

    @router.post("/api/parents", response_model=ParentRead, status_code=status.HTTP_201_CREATED)
    def post_parent(payload: ParentCreate) -> ParentRead:
        """Backs the "I'm a parent" screen. The password is required."""
        try:
            return service.create_parent(payload)
        except DomainError as error:
            raise _http_error(error) from error

    @router.post("/api/parents/{parent_id}/unlock", status_code=status.HTTP_204_NO_CONTENT)
    def unlock_parent(parent_id: int, payload: ParentUnlockRequest) -> None:
        """The parent login. Accepts the parent's password, or the admin
        password as an override. Holds no session: the frontend keeps the
        password and sends it as `X-Parent-Password` on the report reads."""
        try:
            service.unlock(parent_id, payload.password)
        except DomainError as error:
            raise _http_error(error) from error

    @router.delete("/api/parents/{parent_id}", status_code=status.HTTP_204_NO_CONTENT)
    def delete_parent(parent_id: int, x_admin_password: PasswordHeader = None) -> None:
        """Admin-only. Unlinks the parent's kids (their profiles stay)."""
        try:
            service.delete_parent(parent_id, x_admin_password)
        except DomainError as error:
            raise _http_error(error) from error

    @router.get("/api/parents/{parent_id}/kids", response_model=list[KidSummary])
    def list_parent_kids(parent_id: int, x_parent_password: PasswordHeader = None) -> list[KidSummary]:
        """The family overview: each linked kid's last seven days at a glance."""
        try:
            return list(service.kids(parent_id, x_parent_password))
        except DomainError as error:
            raise _http_error(error) from error

    @router.get("/api/parents/{parent_id}/kids/{profile_id}/report", response_model=KidReport)
    def kid_report(
        parent_id: int,
        profile_id: int,
        days: Annotated[int, Query()] = DEFAULT_REPORT_DAYS,
        x_parent_password: PasswordHeader = None,
    ) -> KidReport:
        """One linked kid's progress report over the last `days` days (and the
        same stretch before, for comparison)."""
        try:
            return service.report(parent_id, profile_id, x_parent_password, days)
        except DomainError as error:
            raise _http_error(error) from error

    return router
