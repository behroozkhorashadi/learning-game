"""The Accomplishments screen's endpoints: a profile's badge shelf and its stats."""

from fastapi import APIRouter, HTTPException, status

from app.badges.badges_ports_pure import BadgesService, ProfileNotFoundError
from app.badges.badges_schemas_pure import BadgeStatus, ProfileStats


def bind_badges_routes(*, service: BadgesService) -> APIRouter:
    router = APIRouter()

    @router.get("/api/profiles/{profile_id}/badges", response_model=list[BadgeStatus])
    def get_profile_badges(profile_id: int) -> list[BadgeStatus]:
        """Backs the Accomplishments screen's badge shelf — every seeded badge,
        annotated with whether (and when) this profile earned it."""
        try:
            return list(service.badges_for(profile_id))
        except ProfileNotFoundError as error:
            raise HTTPException(status.HTTP_404_NOT_FOUND, str(error)) from error

    @router.get("/api/profiles/{profile_id}/stats", response_model=ProfileStats)
    def get_profile_stats(profile_id: int) -> ProfileStats:
        """Backs the Accomplishments screen's parent-facing stats — derived live
        from the Rating/Attempt/Event log rather than stored (HANDOFF.md §4)."""
        try:
            return service.stats_for(profile_id)
        except ProfileNotFoundError as error:
            raise HTTPException(status.HTTP_404_NOT_FOUND, str(error)) from error

    return router
