"""HTTP surface for Zombie Horde's armory: the points balance, what's owned, and buying.
Thin: parse, call the injected service, map domain errors to status codes. No auth,
same as the other per-profile routes."""

from fastapi import APIRouter, HTTPException, status

from app.armory.armory_ports_pure import (
    AlreadyOwnedError,
    ArmoryService,
    MissingPrerequisiteError,
    NotEnoughPointsError,
    ProfileNotFoundError,
    UnknownItemError,
)
from app.armory.armory_schemas_pure import ArmoryPurchaseCreate, ArmoryRoundCreate, ArmoryState

ARMORY = "/api/profiles/{profile_id}/armory"


def bind_armory_routes(*, service: ArmoryService) -> APIRouter:
    router = APIRouter(tags=["armory"])

    @router.get(ARMORY)
    def get_armory(profile_id: int) -> ArmoryState:
        """The balance, owned items, grenades left, and the catalog with prices."""
        try:
            return service.state(profile_id)
        except ProfileNotFoundError as error:
            raise HTTPException(status.HTTP_404_NOT_FOUND, str(error)) from error

    @router.post(f"{ARMORY}/rounds")
    def record_armory_round(profile_id: int, payload: ArmoryRoundCreate) -> ArmoryState:
        """Banks a finished round's points and spends the grenades it threw."""
        try:
            return service.record_round(profile_id, payload)
        except ProfileNotFoundError as error:
            raise HTTPException(status.HTTP_404_NOT_FOUND, str(error)) from error

    @router.post(f"{ARMORY}/purchases")
    def purchase_armory_item(profile_id: int, payload: ArmoryPurchaseCreate) -> ArmoryState:
        """Buys one item. 409 when it's already owned, needs another item first, or
        costs more than the balance."""
        try:
            return service.purchase(profile_id, payload.item_id)
        except (ProfileNotFoundError, UnknownItemError) as error:
            raise HTTPException(status.HTTP_404_NOT_FOUND, str(error)) from error
        except (AlreadyOwnedError, MissingPrerequisiteError, NotEnoughPointsError) as error:
            raise HTTPException(status.HTTP_409_CONFLICT, str(error)) from error

    return router
