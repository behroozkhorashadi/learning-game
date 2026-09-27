# Show your stats after the game

**Status:** idea

## Summary

When a game ends, show the player how they actually did: how many they
missed, average time per question, fastest time, and how this session
compares to their past ones. Today the end-of-game screens show only a count
of solved items and a list of them.

## Context

Requested by the user. The motivation is the same one behind
`ideas/points-and-upgrades.md` — give the player a reason to care about
*how well* they played, not just whether they finished — but this one stands
on its own and is much cheaper to build.

**What the end screens show today.** `ZombieArena` (`games/framework/`)
renders two terminal states: `components/SessionComplete.tsx` on a
completed session, and an inline game-over block. Between them they show
`solvedItems.length` out of `brain.sessionLength`, the list of solved items
as chips, a badge, and encouraging copy. No timing, no miss count, nothing
across sessions.

**Most of the data is already being collected — it just isn't shown.**

- `QuestionResult` (`games/framework/zombieArenaTypes.ts`) carries
  `correct`, `timeTakenMs`, and `wrongShots` for every resolved round. Its
  docstring notes it holds "the exact fields the current wave engine
  actually tracks ... Extend this once the engine itself tracks more than
  that."
- `SessionStats` in the same file already exists — `outcome`,
  `solvedCount`, `sessionLength`, `livesRemaining` — and is already handed
  to the optional `brain.onSessionEnd?.()` at both terminal states in
  `ZombieArena`. **Nothing implements that callback today**
  (`ZombieMathBlaster.tsx` doesn't pass one). That unused hook is the
  intended seam for this feature.
- Per-round data is already persisted. `ZombieMathBlaster.onQuestionResult`
  POSTs an attempt with `telemetry: { correct, hints_used: wrongShots,
  time_ms }` and `details: { wrong_shots }`. The `Attempt` table
  (`backend/app/models/attempt.py`) flattens `correct`, `time_ms`,
  `hints_used`, and `level` onto real columns "for queryability," and
  stamps `session_id` and `created_at`.

So the *in-session* stats need no new data at all — only plumbing an
implementation of `onSessionEnd` and a richer `SessionStats`. The
*cross-session* stats ("fastest time ever," "faster than your average") need
a way to read attempt history back, which is the one genuinely missing
piece: `backend/app/main.py` has `POST /api/attempts` but **no** GET for
attempts. There is a precedent to follow —
`GET /api/profiles/{profile_id}/stats` returns `ProfileStats`
(`backend/app/models/stats.py`), computed live by
`compute_profile_stats` in `app/services/badges_service.py`. That module's
docstring states the governing rule: everything is "derived live from
Rating/Attempt/Event rows rather than stored." A per-game stats read-model
should follow the same pattern rather than adding stored counters.

Note `ProfileStats` is explicitly the *parent-facing* Accomplishments view
(total stars, day streak, minutes this week). This idea is the kid-facing,
right-after-the-game view — related, but a different audience and a
different set of numbers. Don't overload `ProfileStats`; add a sibling.

**Tone guardrail.** Per `PRD_adaptive_learning_games.md`, the session
summary should be "encouraging" and rewards "tuned to motivate without dark
patterns." A miss count shown bluntly to a young kid can land badly. Frame
misses as something recoverable and progress as the headline — and where a
number got *worse*, prefer showing nothing over showing a red arrow. There's
precedent for that restraint in the codebase: `ProfileStats.progress_delta_pct`
is documented as `None` when there isn't enough history "rather than
fabricating a number." Do the same here.

## Scope

In scope:
- Extending `SessionStats` with the per-round numbers the arena already has
  in hand: total misses/wrong shots, average time per question, fastest
  single question, total session time, and accuracy.
- Implementing `onSessionEnd` in `ZombieMathBlaster` (and keeping it
  optional on the brain interface, so other arena games can opt in).
- A stats display on both terminal states — the completed-session screen
  (`SessionComplete.tsx`) and the game-over block. Losing a session is
  arguably when seeing "your fastest answer yet" matters most, so don't
  ship it only on the win path.
- Cross-session comparison: personal-best time, and this session's average
  vs. the player's running average. This needs a read endpoint (below).
- A backend endpoint for per-game historical stats, following the
  `compute_profile_stats` pattern — derived live, not stored.

Out of scope:
- Any parent-facing analytics, and any change to the existing
  Accomplishments screen or `ProfileStats`.
- Charts/graphs. A few well-chosen numbers, not a dashboard.
- Extending this to games outside the zombie arena framework (Pathfinder,
  Syllable Builder, …). Keep `SessionStats` generic enough not to block it.
- Leaderboards or any comparison between profiles. Compete with yourself
  only — the app has no player accounts by PRD design.

## Starter instructions for Claude

1. Read `games/framework/zombieArenaTypes.ts`, then the two terminal-state
   renders in `games/framework/ZombieArena.tsx` (the `SessionComplete` usage
   and the game-over block below it — both call `brain.onSessionEnd?.()`),
   then `components/SessionComplete.tsx`, then `games/ZombieMathBlaster.tsx`.
   Confirm the Context notes above still hold.
2. Do the pure/in-session half first — it needs no backend and delivers most
   of the value. Accumulate per-round `QuestionResult`s in the arena, derive
   the session aggregate in a small pure tested helper (not inline in the
   component), extend `SessionStats`, and render it.
3. Decide with the user how the numbers should look before building the
   cross-session half. A compact stat row inside the existing dashed-border
   panel in `SessionComplete.tsx` (where the solved-item chips live now) is
   the low-risk default and reuses the existing visual language; a separate
   card is more prominent but more design work. Show them the simple version
   first.
4. For the cross-session half, add the read endpoint following
   `compute_profile_stats` in `app/services/badges_service.py` — a new
   function and a new response model in `backend/app/models/`, queried live
   off `Attempt` filtered by `profile_id` + `game_id`. Don't store rollups.
   Note `Attempt.time_ms` is per *round*, so "fastest time" means fastest
   single question, not fastest session; if the user actually wants fastest
   *session*, that needs grouping by `session_id` — ask which they meant.
5. Regenerate the frontend types after touching backend models — there's a
   generator at `backend/scripts/generate_ts_types.py` feeding
   `frontend/src/types/generated.ts`. Don't hand-edit the generated file.
6. Only count what the player actually attempted. A session abandoned partway
   shouldn't report a misleading average, and a game-over session has fewer
   rounds than `sessionLength` by definition — make sure the average divides
   by rounds *played*, not rounds *planned*. Cover this with a test.
7. Add tests beside the existing ones: a `.test.ts` for the pure aggregation
   helper, a component test for the stats display (see
   `components/BadgesAccomplishments.test.tsx` for a stats-rendering
   precedent), and a backend test in `backend/tests/` alongside
   `test_badges.py`, which already covers the `compute_profile_stats` path.
8. Raise with the user rather than guessing: whether misses should be shown
   to the kid at all or only the positives (see the tone guardrail above),
   and exactly which four-to-six numbers make the cut — resist showing
   everything that's computable.

## Related

- `ideas/points-and-upgrades.md` — if points land, this screen is where
  "points earned this session" belongs, and both features want the same
  per-wave data threaded out of the arena. Read both before starting
  either; if they're done together, do the telemetry plumbing once.
