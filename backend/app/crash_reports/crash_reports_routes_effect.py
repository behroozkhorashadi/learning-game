"""POST /api/client-errors: a fire-and-forget sink for uncaught frontend errors."""

from fastapi import APIRouter, status

from app.crash_reports.crash_reports_ports_pure import ClientErrorsService
from app.crash_reports.crash_reports_schemas_pure import ClientErrorReport


def bind_crash_reports_routes(*, service: ClientErrorsService) -> APIRouter:
    router = APIRouter()

    @router.post("/api/client-errors", status_code=status.HTTP_204_NO_CONTENT)
    def post_client_error(payload: ClientErrorReport) -> None:
        service.report(payload)

    return router
