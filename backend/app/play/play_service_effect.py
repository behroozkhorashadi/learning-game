"""Play orchestration — PRD §5.1, §5.3, §6: serves items, records attempts and runs
Loop A on them, and records ratings and verifications, writing the event log as it goes.

Loop A's state is derived, not cached. No window table is kept: an attempt records
the level it was played at and the stored Level's `updated_at` marks when that value
was last set, so "attempts at the current level since then" *is* the window (it resets
on any level change). Likewise the confidence item owed after a support decision is
read off the event log (see `pending_confidence_item`), not kept as a flag.
"""

from collections.abc import Callable, Mapping
from dataclasses import dataclass

from app.play.games.game_module_reducers_pure import GameModule
from app.play.loop_a_reducers_pure import (
    LoopAConfig,
    check_frustration_guard,
    evaluate_level,
    pace_for_age,
    select_next_item_level,
)
from app.play.play_ports_pure import (
    AttemptNotFoundError,
    Clock,
    GameRules,
    PlayEvents,
    PlayNeighbors,
    PlayRepository,
    PlayService,
    ProfileNotFoundError,
    Rng,
    UnknownGameError,
)
from app.play.play_reducers_pure import (
    ATTEMPT,
    DIFFICULTY_CHANGED,
    ITEM_SHOWN,
    RATING_GIVEN,
    VERIFICATION_COMPLETED,
    age_of,
    attempt_event,
    attempt_record,
    difficulty_changed_event,
    loop_config_for,
    pending_confidence_item,
    shown_repeat_keys,
    window_of,
)
from app.play.play_schemas_pure import (
    AttemptCreate,
    AttemptRead,
    GameMetadata,
    Item,
    Level,
    Rating,
    RatingCreate,
    Verification,
    VerificationCreate,
)


@dataclass(frozen=True)
class _Play:
    repository: PlayRepository
    events: PlayEvents
    games: Mapping[str, GameModule]
    neighbors: PlayNeighbors
    clock: Clock
    new_rng: Callable[[], Rng]

    def require_age(self, profile_id: int) -> int:
        birth_year = self.neighbors.birth_year(profile_id)
        if birth_year is None:
            raise ProfileNotFoundError(profile_id)
        return age_of(birth_year, self.clock().year)

    def require_game(self, game_id: str) -> GameModule:
        game = self.games.get(game_id)
        if game is None:
            raise UnknownGameError(game_id)
        return game

    def current_level(self, profile_id: int, game_id: str, starting_level: int) -> Level:
        """The stored Level, created at `starting_level` the first time this (profile,
        game) is seen. An existing row is never nudged by a later change to how starting
        levels are computed."""
        level = self.repository.get_level(profile_id, game_id)
        if level is None:
            level = self.repository.save_level(
                Level(profile_id=profile_id, game_id=game_id, value=starting_level, updated_at=self.clock())
            )
        return level

    def list_games(self) -> tuple[GameMetadata, ...]:
        return tuple(game.metadata for game in self.games.values())

    def next_item(self, profile_id: int, game_id: str, session_id: str | None) -> Item:
        age = self.require_age(profile_id)
        game = self.require_game(game_id)
        exclude = (
            shown_repeat_keys(
                game,
                self.events.payloads(
                    profile_id=profile_id, game_id=game_id, session_id=session_id, event_type=ITEM_SHOWN
                ),
            )
            if session_id
            else frozenset[str]()
        )
        # A parent-set practice config fully replaces the adaptive Level for this
        # profile/game, so Loop A's pacing isn't consulted at all.
        practice = self.neighbors.practice_settings(profile_id, game_id) if game.supports_practice_config() else None
        if practice is not None:
            item = game.generate_item_from_practice_config(
                difficulty=practice.difficulty,
                operations=practice.operations,
                focus_numbers=practice.focus_numbers,
                rng=self.new_rng(),
                exclude=exclude,
            )
            pacing = "practice_config"
        else:
            level = self.current_level(profile_id, game_id, game.starting_level_for_age(age))
            latest = self.events.latest(
                profile_id=profile_id, game_id=game_id, event_types=(DIFFICULTY_CHANGED, ITEM_SHOWN)
            )
            directive = select_next_item_level(
                level.value,
                game.metadata.max_level,
                self.new_rng(),
                LoopAConfig(),
                force_confidence_item=pending_confidence_item(latest),
            )
            item = game.generate_item(directive.level, self.new_rng(), exclude=exclude)
            pacing = directive.kind.value

        self.events.append(
            profile_id=profile_id,
            game_id=game_id,
            event_type=ITEM_SHOWN,
            payload={**item.model_dump(), "pacing": pacing},
            variant_id=None,
            session_id=session_id,
        )
        return item

    def run_loop_a(self, payload: AttemptCreate, *, age: int, game: GameModule) -> bool:
        """Checks the frustration guard every attempt, evaluates promote/hold/support
        once the window is full, persists any level change, and logs it with its reason.
        Returns whether the frustration guard fired."""
        config = loop_config_for(payload.game_id) or LoopAConfig()
        level = self.current_level(payload.profile_id, payload.game_id, game.starting_level_for_age(age))
        config = pace_for_age(config, level.value, game.typical_level_for_age(age))
        window = window_of(self.repository.recent_attempts_at_level(level, config.history_size))
        hint_offered = check_frustration_guard(window)
        decision = evaluate_level(level.value, window, game.metadata.max_level, config)
        if decision.changed:
            self.repository.save_level(level.model_copy(update={"value": decision.level, "updated_at": self.clock()}))
            self.events.append(
                profile_id=payload.profile_id,
                game_id=payload.game_id,
                event_type=DIFFICULTY_CHANGED,
                payload=difficulty_changed_event(level.value, decision),
                variant_id=payload.variant_id,
                session_id=payload.session_id,
            )
        return hint_offered

    def record_attempt(self, payload: AttemptCreate) -> AttemptRead:
        age = self.require_age(payload.profile_id)
        game = self.require_game(payload.game_id)
        level = self.current_level(payload.profile_id, payload.game_id, game.starting_level_for_age(age))
        attempt = self.repository.add_attempt(attempt_record(payload, level=level.value, now=self.clock()))
        attempt_id = attempt.id if attempt.id is not None else 0
        event_id = self.events.append(
            profile_id=payload.profile_id,
            game_id=payload.game_id,
            event_type=ATTEMPT,
            payload=attempt_event(attempt, attempt_id),
            variant_id=payload.variant_id,
            session_id=payload.session_id,
        )
        hint_offered = self.run_loop_a(payload, age=age, game=game)
        self.neighbors.after_attempt(payload.profile_id, payload.session_id)
        return AttemptRead(
            id=attempt_id,
            correct=attempt.correct,
            score=attempt.score,
            hints_used=attempt.hints_used,
            time_ms=attempt.time_ms,
            event_id=event_id,
            hint_offered=hint_offered,
        )

    def record_rating(self, payload: RatingCreate) -> Rating:
        self.require_age(payload.profile_id)
        rating = self.repository.add_rating(
            Rating(
                profile_id=payload.profile_id,
                game_id=payload.game_id,
                variant_id=payload.variant_id,
                scale=payload.scale,
                value=payload.value,
                created_at=self.clock(),
            )
        )
        self.events.append(
            profile_id=payload.profile_id,
            game_id=payload.game_id,
            event_type=RATING_GIVEN,
            payload={"rating_id": rating.id, "scale": rating.scale.value, "value": rating.value},
            variant_id=payload.variant_id,
            session_id=None,
        )
        return rating

    def record_verification(self, payload: VerificationCreate) -> Verification:
        attempt = self.repository.get_attempt(payload.attempt_id)
        if attempt is None:
            raise AttemptNotFoundError(payload.attempt_id)
        verification = self.repository.add_verification(
            Verification(
                attempt_id=payload.attempt_id,
                correct=payload.correct,
                verified_by=payload.verified_by,
                verified_at=self.clock(),
            )
        )
        self.events.append(
            profile_id=attempt.profile_id,
            game_id=attempt.game_id,
            event_type=VERIFICATION_COMPLETED,
            payload={"verification_id": verification.id, "attempt_id": attempt.id, "correct": verification.correct},
            variant_id=attempt.variant_id,
            session_id=attempt.session_id,
        )
        return verification

    def game_title(self, game_id: str) -> str | None:
        game = self.games.get(game_id)
        return None if game is None else game.metadata.title

    def game_rules(self, game_id: str) -> GameRules | None:
        game = self.games.get(game_id)
        if game is None:
            return None
        return GameRules(supports_practice_config=game.supports_practice_config(), max_level=game.metadata.max_level)


def make_play_service(
    *,
    repository: PlayRepository,
    events: PlayEvents,
    games: Mapping[str, GameModule],
    neighbors: PlayNeighbors,
    clock: Clock,
    new_rng: Callable[[], Rng],
) -> PlayService:
    impl = _Play(repository=repository, events=events, games=games, neighbors=neighbors, clock=clock, new_rng=new_rng)
    return PlayService(
        list_games=impl.list_games,
        next_item=impl.next_item,
        record_attempt=impl.record_attempt,
        record_rating=impl.record_rating,
        record_verification=impl.record_verification,
        game_title=impl.game_title,
        game_rules=impl.game_rules,
        delete_for_profile=impl.repository.delete_for_profile,
    )
