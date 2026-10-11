"""HTTP surface for practice configs: GET/PUT/DELETE /api/practice-config. Thin: parse,
call the injected service, map domain errors to status codes. No auth: a practice
preference, not a destructive action."""

from fastapi import APIRouter, HTTPException, status

from app.practice.practice_ports_pure import (
    InvalidPracticeConfigError,
    PracticeConfigNotFoundError,
    PracticeService,
    ProfileNotFoundError,
    UnknownGameError,
)
from app.practice.practice_schemas_pure import PracticeConfig, PracticeConfigUpsert

PATH = "/api/practice-config"


def bind_practice_routes(*, service: PracticeService) -> APIRouter:
    router = APIRouter()

    @router.get(PATH, response_model=PracticeConfig)
    def get_practice_config(profile_id: int, game_id: str) -> PracticeConfig:
        """Backs the practice-settings screen (e.g. Equation Outbreak's focus
        picker). 404 means "no config yet — this game is on automatic
        difficulty," not an error."""
        try:
            return service.get_config(profile_id, game_id)
        except PracticeConfigNotFoundError as error:
            raise HTTPException(status.HTTP_404_NOT_FOUND, str(error)) from error

    @router.put(PATH, response_model=PracticeConfig)
    def put_practice_config(payload: PracticeConfigUpsert) -> PracticeConfig:
        """Creates or replaces the (profile_id, game_id) config — no auth (PRD §2
        non-goals): this is a practice preference, not a destructive action, so
        it doesn't need the admin screen's password gate."""
        try:
            return service.put_config(payload)
        except (ProfileNotFoundError, UnknownGameError) as error:
            raise HTTPException(status.HTTP_404_NOT_FOUND, str(error)) from error
        except InvalidPracticeConfigError as error:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, str(error)) from error

    @router.delete(PATH, status_code=status.HTTP_204_NO_CONTENT)
    def delete_practice_config(profile_id: int, game_id: str) -> None:
        """Reverts this profile/game to the server-adaptive Level."""
        try:
            service.delete_config(profile_id, game_id)
        except PracticeConfigNotFoundError as error:
            raise HTTPException(status.HTTP_404_NOT_FOUND, str(error)) from error

    return router
