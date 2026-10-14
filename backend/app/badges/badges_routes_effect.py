"""The Accomplishments screen's endpoints: a profile's badge shelf and its stats, the
badges waiting to be celebrated, and painting a badge's personal art."""

from fastapi import APIRouter, HTTPException, status

from app.badges.badges_ports_pure import BadgeNotEarnedError, BadgeNotFoundError, BadgesService, ProfileNotFoundError
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

    @router.get("/api/profiles/{profile_id}/badges/new", response_model=list[BadgeStatus])
    def get_new_badges(profile_id: int) -> list[BadgeStatus]:
        """Badges this profile earned but hasn't celebrated yet, oldest first.
        Cheap enough to poll while the kid plays."""
        try:
            return list(service.uncelebrated(profile_id))
        except ProfileNotFoundError as error:
            raise HTTPException(status.HTTP_404_NOT_FOUND, str(error)) from error

    @router.post("/api/profiles/{profile_id}/badges/{key}/celebrated", status_code=status.HTTP_204_NO_CONTENT)
    def mark_celebrated(profile_id: int, key: str) -> None:
        """The kid has seen this badge's celebration."""
        try:
            service.mark_celebrated(profile_id, key)
        except (ProfileNotFoundError, BadgeNotFoundError) as error:
            raise HTTPException(status.HTTP_404_NOT_FOUND, str(error)) from error
        except BadgeNotEarnedError as error:
            raise HTTPException(status.HTTP_409_CONFLICT, str(error)) from error

    @router.post("/api/profiles/{profile_id}/badges/{key}/art", response_model=BadgeStatus)
    def paint_badge(profile_id: int, key: str) -> BadgeStatus:
        """Paints this profile's own art for a badge it earned, and waits for it (a
        few seconds). The badge comes back with art_status ready, or failed."""
        try:
            return service.paint(profile_id, key)
        except (ProfileNotFoundError, BadgeNotFoundError) as error:
            raise HTTPException(status.HTTP_404_NOT_FOUND, str(error)) from error
        except BadgeNotEarnedError as error:
            raise HTTPException(status.HTTP_409_CONFLICT, str(error)) from error

    @router.get("/api/profiles/{profile_id}/stats", response_model=ProfileStats)
    def get_profile_stats(profile_id: int) -> ProfileStats:
        """Backs the Accomplishments screen's parent-facing stats — derived live
        from the Rating/Attempt/Event log rather than stored (HANDOFF.md §4)."""
        try:
            return service.stats_for(profile_id)
        except ProfileNotFoundError as error:
            raise HTTPException(status.HTTP_404_NOT_FOUND, str(error)) from error

    return router
