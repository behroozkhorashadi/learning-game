"""Badge seeding, awarding, and the stats read model.

Awarding is idempotent (one award per profile and badge), so `evaluate` is safe to call
after every attempt and piece without tracking "have we already checked" state. Badges
are evaluated in seed order, so "champion" (earn all others, seeded last) sees the
results of the same pass."""

from app.badges.badges_ports_pure import (
    BadgeEvents,
    BadgeNeighbors,
    BadgeRepository,
    BadgesService,
    Clock,
    ProfileNotFoundError,
)
from app.badges.badges_reducers_pure import SEED_BADGES, criterion_met, profile_stats
from app.badges.badges_schemas_pure import BadgeStatus, ProfileStats

BADGE_AWARDED = "badge_awarded"


def make_badges_service(
    *, repository: BadgeRepository, events: BadgeEvents, neighbors: BadgeNeighbors, clock: Clock
) -> BadgesService:
    def require(profile_id: int) -> None:
        if not neighbors.profile_exists(profile_id):
            raise ProfileNotFoundError(profile_id)

    def seed() -> None:
        repository.add_missing(SEED_BADGES)

    def evaluate(profile_id: int, session_id: str | None) -> tuple[str, ...]:
        badges = repository.badges()
        all_ids = {badge.id for badge in badges}
        awarded = set(repository.awards(profile_id))
        activity = neighbors.activity(profile_id)
        newly: list[str] = []
        for badge in badges:
            if badge.id in awarded or not criterion_met(badge, activity, awarded=awarded, all_badge_ids=all_ids):
                continue
            repository.award(profile_id, badge.id, session_id, clock())
            awarded.add(badge.id)
            newly.append(badge.key)
            events.append(
                profile_id=profile_id,
                game_id="badges",
                event_type=BADGE_AWARDED,
                payload={"badge_id": badge.id, "badge_key": badge.key},
                variant_id=None,
                session_id=session_id,
            )
        return tuple(newly)

    def badges_for(profile_id: int) -> tuple[BadgeStatus, ...]:
        require(profile_id)
        awards = repository.awards(profile_id)
        return tuple(
            BadgeStatus(
                key=badge.key,
                name=badge.name,
                description=badge.description,
                art_url=badge.art_url,
                earned=badge.id in awards,
                awarded_at=awards[badge.id].awarded_at if badge.id in awards else None,
            )
            for badge in repository.badges()
        )

    def stats_for(profile_id: int) -> ProfileStats:
        require(profile_id)
        return profile_stats(neighbors.activity(profile_id), today=clock().date(), game_title=neighbors.game_title)

    return BadgesService(
        seed=seed,
        evaluate=evaluate,
        badges_for=badges_for,
        stats_for=stats_for,
        delete_for_profile=repository.delete_for_profile,
    )
