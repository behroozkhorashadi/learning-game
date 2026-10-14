"""Badge seeding, awarding, personal art, celebrations, and the stats read model.

Awarding is idempotent (one award per profile and badge), so `evaluate` is safe to call
after every attempt and piece without tracking "have we already checked" state. Badges
that depend on all the others ("champion") are evaluated last, so they see the results
of the same pass.

A new award starts uncelebrated, with its art pending: the painting runs later (off the
request that earned it) and lands as ready or failed. The kid's screens ask for
`uncelebrated` badges to throw them a party, then mark them celebrated."""

from dataclasses import dataclass

from app.badges.badges_ports_pure import (
    BadgeArt,
    BadgeEvents,
    BadgeNeighbors,
    BadgeNotEarnedError,
    BadgeNotFoundError,
    BadgeRepository,
    BadgesService,
    Clock,
    LocalDay,
    ProfileNotFoundError,
)
from app.badges.badges_reducers_pure import (
    SEED_BADGES,
    Shelf,
    art_request,
    badge_art_prompt,
    badge_status,
    criterion_met,
    evaluation_order,
    profile_stats,
    shelf_position,
)
from app.badges.badges_schemas_pure import ArtRequest, AwardDetail, Badge, BadgeStatus, ProfileStats

BADGE_AWARDED = "badge_awarded"


@dataclass(frozen=True)
class _Badges:
    repository: BadgeRepository
    events: BadgeEvents
    neighbors: BadgeNeighbors
    art: BadgeArt
    clock: Clock
    local_day: LocalDay

    def require(self, profile_id: int) -> None:
        if not self.neighbors.profile_exists(profile_id):
            raise ProfileNotFoundError(profile_id)

    def seed(self) -> None:
        self.repository.sync(SEED_BADGES)

    def evaluate(self, profile_id: int, session_id: str | None) -> tuple[str, ...]:
        badges = self.repository.badges()
        all_ids = {badge.id for badge in badges}
        awarded = set(self.repository.awards(profile_id))
        activity = self.neighbors.activity(profile_id)
        newly: list[Badge] = []
        for badge in evaluation_order(badges):
            if badge.id in awarded or not criterion_met(
                badge, activity, awarded=awarded, all_badge_ids=all_ids, day_of=self.local_day
            ):
                continue
            self.repository.award(profile_id, badge.id, session_id, self.clock())
            self.repository.save_detail(
                profile_id, AwardDetail(badge_id=badge.id, art_status="pending", art_url=None, celebrated=False)
            )
            awarded.add(badge.id)
            newly.append(badge)
            self.events.append(
                profile_id=profile_id,
                game_id="badges",
                event_type=BADGE_AWARDED,
                payload={"badge_id": badge.id, "badge_key": badge.key},
                variant_id=None,
                session_id=session_id,
            )
        mascot = self.neighbors.mascot(profile_id)
        for badge in newly:
            request = art_request(badge, activity, game_title=self.neighbors.game_title, mascot=mascot)
            self.art.run_later(lambda badge=badge, request=request: self.paint_now(profile_id, badge, request))
        return tuple(badge.key for badge in newly)

    def paint_now(self, profile_id: int, badge: Badge, request: ArtRequest) -> None:
        image = self.art.paint(badge_art_prompt(request))
        url = None if image is None else self.art.store.save(image)
        # Read after painting: the kid may have celebrated while it painted.
        before = self.repository.details(profile_id).get(badge.id)
        self.repository.save_detail(
            profile_id,
            AwardDetail(
                badge_id=badge.id,
                art_status="failed" if url is None else "ready",
                art_url=url,
                celebrated=before.celebrated if before is not None else True,
            ),
        )

    def shelf(self, profile_id: int) -> tuple[BadgeStatus, ...]:
        badges = sorted(self.repository.badges(), key=lambda badge: shelf_position(badge.key))
        awards = self.repository.awards(profile_id)
        details = self.repository.details(profile_id)
        shelf = Shelf(
            activity=self.neighbors.activity(profile_id),
            awarded=frozenset(awards),
            all_ids=frozenset(badge.id for badge in badges),
            day_of=self.local_day,
            game_title=self.neighbors.game_title,
        )
        return tuple(badge_status(badge, awards.get(badge.id), details.get(badge.id), shelf) for badge in badges)

    def badges_for(self, profile_id: int) -> tuple[BadgeStatus, ...]:
        """Catches up first, so a badge added since the profile last played is
        awarded as soon as its shelf is looked at."""
        self.require(profile_id)
        self.evaluate(profile_id, None)
        return self.shelf(profile_id)

    def uncelebrated(self, profile_id: int) -> tuple[BadgeStatus, ...]:
        self.require(profile_id)
        waiting = [s for s in self.shelf(profile_id) if s.earned and not s.celebrated]
        return tuple(sorted(waiting, key=lambda s: s.awarded_at or self.clock()))

    def earned_badge(self, profile_id: int, key: str) -> Badge:
        self.require(profile_id)
        badge = next((b for b in self.repository.badges() if b.key == key), None)
        if badge is None:
            raise BadgeNotFoundError(key)
        if badge.id not in self.repository.awards(profile_id):
            raise BadgeNotEarnedError(key)
        return badge

    def mark_celebrated(self, profile_id: int, key: str) -> None:
        badge = self.earned_badge(profile_id, key)
        detail = self.repository.details(profile_id).get(badge.id)
        if detail is None:
            return  # an old award: already counts as celebrated
        self.repository.save_detail(profile_id, detail.model_copy(update={"celebrated": True}))

    def paint(self, profile_id: int, key: str) -> BadgeStatus:
        badge = self.earned_badge(profile_id, key)
        activity = self.neighbors.activity(profile_id)
        mascot = self.neighbors.mascot(profile_id)
        self.paint_now(
            profile_id, badge, art_request(badge, activity, game_title=self.neighbors.game_title, mascot=mascot)
        )
        return next(s for s in self.shelf(profile_id) if s.key == key)

    def stats_for(self, profile_id: int) -> ProfileStats:
        self.require(profile_id)
        return profile_stats(
            self.neighbors.activity(profile_id),
            today=self.local_day(self.clock()),
            day_of=self.local_day,
            game_title=self.neighbors.game_title,
        )


def make_badges_service(
    *,
    repository: BadgeRepository,
    events: BadgeEvents,
    neighbors: BadgeNeighbors,
    art: BadgeArt,
    clock: Clock,
    local_day: LocalDay,
) -> BadgesService:
    """`local_day` decides which calendar day a moment counts toward, for streaks and the
    day-by-day breakdown."""
    badges = _Badges(
        repository=repository, events=events, neighbors=neighbors, art=art, clock=clock, local_day=local_day
    )
    return BadgesService(
        seed=badges.seed,
        evaluate=badges.evaluate,
        badges_for=badges.badges_for,
        uncelebrated=badges.uncelebrated,
        mark_celebrated=badges.mark_celebrated,
        paint=badges.paint,
        stats_for=badges.stats_for,
        delete_for_profile=repository.delete_for_profile,
    )
