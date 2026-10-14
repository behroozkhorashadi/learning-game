"""HTTP surface for a profile's looks: the skin worn, the suit and blaster paint, the
emblem, and the art hung in the games. Thin: parse, call the injected service, map errors."""

from fastapi import APIRouter, HTTPException, status

from app.armory.armory_ports_pure import LookLockedError, LooksService, ProfileNotFoundError, UnknownArtError
from app.armory.armory_schemas_pure import ArmoryLooks, ArmoryLooksState

LOOKS = "/api/profiles/{profile_id}/armory/looks"


def bind_looks_routes(*, service: LooksService) -> APIRouter:
    router = APIRouter(tags=["armory"])

    @router.get(LOOKS)
    def get_looks(profile_id: int) -> ArmoryLooksState:
        """The profile's looks (the default look until first saved), with the URL of each art piece they use."""
        try:
            return service.state(profile_id)
        except ProfileNotFoundError as error:
            raise HTTPException(status.HTTP_404_NOT_FOUND, str(error)) from error

    @router.put(LOOKS)
    def save_looks(profile_id: int, payload: ArmoryLooks) -> ArmoryLooksState:
        """Saves the looks. 409 when one needs an unlock (or skin) that isn't owned, or
        uses art that isn't in this profile's gallery."""
        try:
            return service.save(profile_id, payload)
        except ProfileNotFoundError as error:
            raise HTTPException(status.HTTP_404_NOT_FOUND, str(error)) from error
        except (LookLockedError, UnknownArtError) as error:
            raise HTTPException(status.HTTP_409_CONFLICT, str(error)) from error

    return router
