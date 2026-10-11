"""HTTP surface for playing: the game list, the next item, attempts, ratings, and
verifications. Thin: parse, call the injected service, map domain errors to status
codes. Handler names and docstrings are part of the API contract."""

from fastapi import APIRouter, HTTPException, status

from app.play.play_ports_pure import AttemptNotFoundError, PlayService, ProfileNotFoundError, UnknownGameError
from app.play.play_schemas_pure import (
    AttemptCreate,
    AttemptRead,
    GameMetadata,
    Item,
    Rating,
    RatingCreate,
    Verification,
    VerificationCreate,
)

NotFound = (ProfileNotFoundError, UnknownGameError, AttemptNotFoundError)


def bind_play_routes(*, service: PlayService) -> APIRouter:
    router = APIRouter()

    @router.get("/api/games", response_model=list[GameMetadata])
    def list_games() -> list[GameMetadata]:
        """Backs the Game Picker screen — lists every registered game module."""
        return list(service.list_games())

    @router.get("/api/items/next", response_model=Item)
    def get_next_item(profile_id: int, game_id: str, session_id: str | None = None) -> Item:
        try:
            return service.next_item(profile_id, game_id, session_id)
        except NotFound as error:
            raise HTTPException(status.HTTP_404_NOT_FOUND, str(error)) from error

    @router.post("/api/attempts", response_model=AttemptRead, status_code=status.HTTP_201_CREATED)
    def post_attempt(payload: AttemptCreate) -> AttemptRead:
        try:
            return service.record_attempt(payload)
        except NotFound as error:
            raise HTTPException(status.HTTP_404_NOT_FOUND, str(error)) from error

    @router.post("/api/ratings", response_model=Rating, status_code=status.HTTP_201_CREATED)
    def post_rating(payload: RatingCreate) -> Rating:
        try:
            return service.record_rating(payload)
        except NotFound as error:
            raise HTTPException(status.HTTP_404_NOT_FOUND, str(error)) from error

    @router.post("/api/verifications", response_model=Verification, status_code=status.HTTP_201_CREATED)
    def post_verification(payload: VerificationCreate) -> Verification:
        try:
            return service.record_verification(payload)
        except NotFound as error:
            raise HTTPException(status.HTTP_404_NOT_FOUND, str(error)) from error

    return router
