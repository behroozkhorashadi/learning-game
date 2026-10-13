# Show your stats after the game

**Status:** idea (partly built: Outbreak shows right answers, average time, and each question)

## Summary

When a game ends, show the player how they actually did: how many they
missed, average time per question, fastest time, and how this session
compares to their past ones. Part of this exists; the rest is the
cross-session half and a couple of in-session numbers.

## Context

Requested by the user. Same motivation as
`ideas/outbreak-points-and-reload.md` (a reason to care *how well* you
played), but it stands on its own and is cheaper to build.

### What exists today (verified 2026-10-12; re-check)

- **Equation Outbreak already has an in-session stats card.**
  `src/outbreak/arena_performance_summary.pure.ui.tsx` (`ArenaPerformanceSummary`)
  shows "Questions right" (n / answered), "Average response", and every
  question with its result. It's rendered on both end states in
  `src/outbreak/zombie_arena.effect.ui.tsx`: through `SessionComplete`'s
  `summarySlot` (`src/session/session_complete.pure.ui.tsx`) on a win, and
  directly in the game-over block. The numbers come from `summarizeResults`
  in `src/outbreak/arena_session.pure.lib.ts`, over the
  `questionResults` that `use_arena_session.pure.hook.ts` collects.
- **What it doesn't have:** `SessionQuestionResult` carries only `question`,
  `correct`, `timeTakenMs`. No wrong-shot count (the brain has it:
  `fact_fluency_brain.effect.lib.ts` sends `hints_used: result.wrongShots`),
  no fastest question, and nothing across sessions.
- **Zombie Horde** has its own results screen (`src/horde/horde_results.pure.ui.tsx`)
  with points line by line and a personal best (the longest round, from the
  armory ledger's `best_survived_ms`). That's Horde's version of a
  cross-session stat; leave it, but match its tone.
- **Per-question data is persisted.** Every answer is `POST /api/attempts`
  (`backend/app/play/play_routes_effect.py`) with `correct`, `time_ms`,
  `hints_used`, the session id, and a timestamp. There is **no GET** for
  attempts. The precedent for a read-model is `GET /api/profiles/{id}/stats`
  (`backend/app/badges/`, `ProfileStats` in `badges_schemas_pure.py`), derived
  live from the logs rather than stored. Follow that, but in a sibling, not
  by growing `ProfileStats`: that one is the parent-facing Accomplishments
  view; this is the kid-facing, right-after-the-game view.

### Tone guardrail

Per `PRD_adaptive_learning_games.md`, the session summary should be
"encouraging" and rewards "tuned to motivate without dark patterns". A miss
count shown bluntly to a young kid can land badly. Make progress the headline,
treat misses as recoverable, and where a number got *worse*, show nothing
rather than a red arrow. Precedent: `ProfileStats.progress_delta_pct` is
`None` when there isn't enough history rather than a made-up number.

## Scope

In scope (Equation Outbreak first):
- In-session: add fastest question and, if the user wants it shown, wrong
  shots (carry `wrongShots` on `SessionQuestionResult`). Extend
  `summarizeResults`, keep it pure and tested.
- Cross-session: personal-best time and this session's average vs. the
  player's running average, on both end states (losing is arguably when "your
  fastest answer yet" matters most).
- A backend read endpoint for per-game history stats, derived live from
  attempts filtered by profile and game. No stored rollups.

Out of scope:
- Parent-facing analytics; any change to Accomplishments or `ProfileStats`.
- Charts. A few well-chosen numbers, not a dashboard.
- Zombie Horde's results screen (it has its own best already) and other games.
  Keep the backend endpoint game-agnostic so they can opt in later.
- Leaderboards or comparing profiles. Compete with yourself only.

## Starter instructions for Claude

1. Read `AGENTS.md`, then `src/outbreak/arena_session.pure.lib.ts`,
   `arena_performance_summary.pure.ui.tsx`, `use_arena_session.pure.hook.ts`,
   the two end states in `zombie_arena.effect.ui.tsx`, and
   `backend/app/badges/` (routes, service, schemas) as the read-model pattern.
   Re-check the facts above.
2. In-session half first: no backend needed. Extend the result type and
   `summarizeResults`, then the card, with tests and the story updated.
3. Show the user the simple version before building the cross-session half.
4. Cross-session: a new endpoint and response model (a sibling of the badges
   stats, or under `backend/app/play/`; follow `backend/AGENTS.md`), queried
   live off attempts by profile + game. `time_ms` is per *question*, so
   "fastest" means fastest single answer; if the user means fastest
   *session*, that needs grouping by session id. Ask which. Then
   `make gen-api` and a zod adapter in `src/api/`, injected via `bind*`.
5. Average over questions *played*, not planned: a game-over session has
   fewer than the session length. Cover it with a test.
6. Ask the user rather than guessing: whether misses are shown at all, and
   which four to six numbers make the cut. Resist showing everything
   computable.

## Related

- `ideas/outbreak-points-and-reload.md`: "points earned this session" belongs
  on this screen, and both want the same per-wave data; do that plumbing once.
- `ideas/zombie-horde.md`: Horde's results screen and personal best.
