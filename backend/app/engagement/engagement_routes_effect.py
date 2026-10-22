"""HTTP endpoints for writing active-time spans and reading their admin summary."""

from typing import Annotated

from fastapi import APIRouter, Header, HTTPException, status

from app.engagement.engagement_ports_pure import EngagementService
from app.engagement.engagement_schemas_pure import EngagementBatch, EngagementSummary


def bind_engagement_routes(*, service: EngagementService) -> APIRouter:
    router = APIRouter(tags=["engagement"])

    @router.post("/api/engagement", status_code=status.HTTP_204_NO_CONTENT)
    def record_engagement(payload: EngagementBatch) -> None:
        service.record(payload)

    @router.get("/api/admin/engagement")
    def engagement_summary(
        x_admin_password: Annotated[str | None, Header()] = None,
    ) -> list[EngagementSummary]:
        try:
            return list(service.summary(x_admin_password))
        except PermissionError as error:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, str(error)) from error

    return router
