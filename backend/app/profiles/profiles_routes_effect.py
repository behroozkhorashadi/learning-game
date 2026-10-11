"""HTTP surface for profiles: the picker list, create, unlock, edit, saved pictures,
the remix preview, and the admin-only delete. Thin: parse, call the injected services,
map domain errors to status codes. Handler names and docstrings are part of the API
contract (operation ids and descriptions), so they stay as they were."""

from typing import Annotated

from fastapi import APIRouter, Header, HTTPException, status

from app.profiles.profiles_ports_pure import (
    CurrentPhotoError,
    InvalidProfileError,
    NotAdminError,
    PhotoNotFoundError,
    PhotoRemixService,
    ProfileNotFoundError,
    ProfilesService,
    RemixUnavailableError,
    WrongProfilePasswordError,
)
from app.profiles.profiles_schemas_pure import (
    ProfileCreate,
    ProfilePhotoRead,
    ProfilePhotoRemixRequest,
    ProfilePhotoRemixResponse,
    ProfileRead,
    ProfileUnlockRequest,
    ProfileUpdate,
)

PasswordHeader = Annotated[str | None, Header()]


def _http_error(error: Exception) -> HTTPException:
    if isinstance(error, ProfileNotFoundError | PhotoNotFoundError):
        return HTTPException(status.HTTP_404_NOT_FOUND, str(error))
    if isinstance(error, WrongProfilePasswordError | NotAdminError):
        return HTTPException(status.HTTP_401_UNAUTHORIZED, str(error))
    if isinstance(error, CurrentPhotoError):
        return HTTPException(status.HTTP_409_CONFLICT, str(error))
    if isinstance(error, RemixUnavailableError):
        return HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(error))
    return HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, str(error))


DomainError = (
    ProfileNotFoundError,
    PhotoNotFoundError,
    WrongProfilePasswordError,
    NotAdminError,
    CurrentPhotoError,
    RemixUnavailableError,
    InvalidProfileError,
)


def bind_profiles_routes(*, service: ProfilesService, remix: PhotoRemixService) -> APIRouter:
    router = APIRouter()

    @router.get("/api/profiles", response_model=list[ProfileRead])
    def list_profiles() -> list[ProfileRead]:
        """Read-only listing for the profile-picker screen. No auth (PRD §2 non-goals)
        — `has_password` tells the picker which profiles to ask a password for."""
        return list(service.list_profiles())

    @router.post("/api/profiles", response_model=ProfileRead, status_code=status.HTTP_201_CREATED)
    def post_profile(payload: ProfileCreate) -> ProfileRead:
        """Backs the create-profile screen. No auth (PRD §2 non-goals) — anyone on
        the LAN can add a player, same trust model as everything else here."""
        try:
            return service.create_profile(payload)
        except DomainError as error:
            raise _http_error(error) from error

    @router.post("/api/profiles/{profile_id}/unlock", status_code=status.HTTP_204_NO_CONTENT)
    def unlock_profile(profile_id: int, payload: ProfileUnlockRequest) -> None:
        """Backs the password prompt shown when a kid picks a protected profile
        (or opens its edit screen). Accepts the profile's own password, or the
        admin password as an override. A profile with no password always
        unlocks. Like `admin_login`, this holds no session state — the frontend
        keeps the password and sends it on later edits as `X-Profile-Password`."""
        try:
            service.unlock(profile_id, payload.password)
        except DomainError as error:
            raise _http_error(error) from error

    @router.post("/api/profile-photos/remix", response_model=ProfilePhotoRemixResponse)
    def remix_profile_photo_preview(payload: ProfilePhotoRemixRequest) -> ProfilePhotoRemixResponse:
        """Backs the photo "remix" panel on the create/edit-profile screens: sends
        the captured photo plus a preset style and/or the kid's own idea to the
        image provider and hands the result straight back for preview. Nothing is
        saved here — the versions the kid keeps come back as `new_photos` on the
        profile create/update. No auth, same trust model as POST /api/profiles."""
        try:
            return remix.remix_preview(payload)
        except DomainError as error:
            raise _http_error(error) from error

    @router.patch("/api/profiles/{profile_id}", response_model=ProfileRead)
    def patch_profile(
        profile_id: int,
        payload: ProfileUpdate,
        x_profile_password: PasswordHeader = None,
        x_admin_password: PasswordHeader = None,
    ) -> ProfileRead:
        """Backs the edit-profile screen. A password-protected profile needs its
        own password (`X-Profile-Password`) or the admin password (either header)
        — see `app/services/profile_passwords.py`. A profile with no password is
        editable by anyone, same as creating one."""
        try:
            return service.update_profile(profile_id, payload, x_profile_password, x_admin_password)
        except DomainError as error:
            raise _http_error(error) from error

    @router.get("/api/profiles/{profile_id}/photos", response_model=list[ProfilePhotoRead])
    def list_profile_photos(
        profile_id: int,
        x_profile_password: PasswordHeader = None,
        x_admin_password: PasswordHeader = None,
    ) -> list[ProfilePhotoRead]:
        """Backs the edit screen's "Your pictures" strip — every saved photo and
        AI remix, oldest first. Same access rule as PATCH."""
        try:
            return list(service.list_photos(profile_id, x_profile_password, x_admin_password))
        except DomainError as error:
            raise _http_error(error) from error

    @router.delete("/api/profiles/{profile_id}/photos/{photo_id}", status_code=status.HTTP_204_NO_CONTENT)
    def delete_profile_photo(
        profile_id: int,
        photo_id: int,
        x_profile_password: PasswordHeader = None,
        x_admin_password: PasswordHeader = None,
    ) -> None:
        """Removes one saved picture (row and file). 409 for the current profile
        picture — switch to another first. Same access rule as PATCH."""
        try:
            service.delete_photo(profile_id, photo_id, x_profile_password, x_admin_password)
        except DomainError as error:
            raise _http_error(error) from error

    @router.delete("/api/profiles/{profile_id}", status_code=status.HTTP_204_NO_CONTENT)
    def delete_profile(profile_id: int, x_admin_password: PasswordHeader = None) -> None:
        """Admin-only (see `app/admin_auth.py`) — backs the admin screen's remove
        action. Removes every row that hangs off this profile first since
        there's no DB-level cascade configured (same reasoning as `delete_piece`)."""
        try:
            service.delete_profile(profile_id, x_admin_password)
        except DomainError as error:
            raise _http_error(error) from error

    return router
