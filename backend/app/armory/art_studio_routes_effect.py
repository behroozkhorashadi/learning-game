"""HTTP surface for the art studio: the profile's gallery, and making a new piece
(paid for with armory points). Thin: parse, call the injected service, map errors."""

from fastapi import APIRouter, HTTPException, status

from app.armory.armory_ports_pure import (
    ArtStudioService,
    ArtUnavailableError,
    InvalidArtError,
    NotEnoughPointsError,
    ProfileNotFoundError,
)
from app.armory.armory_schemas_pure import ArtCreate, ArtPiece, ArtResult

ART = "/api/profiles/{profile_id}/armory/art"


def bind_art_studio_routes(*, service: ArtStudioService) -> APIRouter:
    router = APIRouter(tags=["armory"])

    @router.get(ART)
    def list_art(profile_id: int) -> list[ArtPiece]:
        """The profile's gallery, newest first."""
        try:
            return list(service.gallery(profile_id))
        except ProfileNotFoundError as error:
            raise HTTPException(status.HTTP_404_NOT_FOUND, str(error)) from error

    @router.post(ART, status_code=status.HTTP_201_CREATED)
    def create_art(profile_id: int, payload: ArtCreate) -> ArtResult:
        """Turns a selfie into art and keeps it. Points are charged only when the art
        is made: 409 when they can't be afforded, 503 when the AI isn't available."""
        try:
            return service.create_art(profile_id, payload)
        except ProfileNotFoundError as error:
            raise HTTPException(status.HTTP_404_NOT_FOUND, str(error)) from error
        except NotEnoughPointsError as error:
            raise HTTPException(status.HTTP_409_CONFLICT, str(error)) from error
        except InvalidArtError as error:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, str(error)) from error
        except ArtUnavailableError as error:
            raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(error)) from error

    return router
