"""POST /api/admin/login: lets the admin screen check a password before showing itself."""

from fastapi import APIRouter, HTTPException, status

from app.admin.admin_ports_pure import AdminService, InvalidAdminPasswordError
from app.admin.admin_schemas_pure import AdminLoginRequest


def bind_admin_routes(*, service: AdminService) -> APIRouter:
    router = APIRouter()

    @router.post("/api/admin/login", status_code=status.HTTP_204_NO_CONTENT)
    def admin_login(payload: AdminLoginRequest) -> None:
        """Lets the admin screen check a password before showing itself — a UX
        nicety, not the actual gate. `require_admin` (checked per-request on the
        admin-only endpoints below) is what actually protects anything; this
        endpoint holds no session state of its own."""
        try:
            service.verify(payload.password)
        except InvalidAdminPasswordError as error:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, str(error)) from error

    return router
