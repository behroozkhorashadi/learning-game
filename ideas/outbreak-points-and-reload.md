# Equation Outbreak: earn points, spend them on a faster reload

**Status:** idea

## Summary

Give Equation Outbreak players points for playing well, paid into the same
balance Zombie Horde already uses, and let them spend points on a faster
reload, up to *zero* reload so both shots of a wave can be fired back to back.
The reward for doing well is more thinking time, not a way to skip the math.

## Context

This came from the user (the kid's parent) as a motivation lever. The file
used to be `points-and-upgrades.md`, which also covered zombie health, hit
zones, and a weapon and bullet catalog. The user moved that half into a new
game so Outbreak stays as it is ("I don't want to pollute the old game"), and
it's now built: see `ideas/zombie-horde.md`. What's left here is the original,
smaller idea: points and reload for Outbreak. Outbreak's rules (exactly two
shots per wave, any accepted hit defeats) don't change.

### What exists today (verified 2026-10-12; re-check)

- **The points balance already exists.** Zombie Horde's armory,
  `backend/app/armory/`, is an append-only per-profile ledger: `earned`,
  `purchased`, `grenades_used`, `rounds_used`, and `survived` entries, with the
  balance derived as earned − spent. Frontend adapter:
  `frontend/src/api/armory_api.effect.lib.ts` (`load`, `recordRound`,
  `purchase`). So the old "localStorage or backend?" question is settled: use
  this ledger, one balance across both games.
  - `ArmoryRoundCreate` (`backend/app/armory/armory_schemas_pure.py`) is
    shaped for a Horde round (points, grenades, special rounds, `survived_ms`).
    `best_survived_ms` is the max of *all* `survived` entries for the profile,
    so if Outbreak banks rounds through it, it must send `survived_ms: 0` or
    the endpoint needs a game id. Decide which (probably a small
    Outbreak-specific request, or a `game_id` on entries).
- **Reload is one number.** `WeaponDefinition.cockingMs`
  (`frontend/src/blaster/weapon_definitions.pure.lib.ts`) is "the sole gate on
  the second shot". `STARTER_BLASTER` is 900ms. The same file now also has
  `RAPID_BLASTER` (350ms, `unlockCost: 250`) and `MEGA_BLASTER` (200ms),
  which Zombie Horde sells.
- **Outbreak takes its weapon as a dep.** `bindZombieArena` gets `weapon`
  from `frontend/src/outbreak/zombie_math_blaster.assembly.main.ts`, hard-wired
  to `STARTER_BLASTER`, and passes `weapon.cockingMs` into
  `buildWaveConfig(approachMs, cockingMs)`
  (`frontend/src/outbreak/arena_session.pure.lib.ts`). That's the chokepoint:
  the weapon has to become per-profile, chosen from what the profile owns.
- **The engine stays ignorant.** `frontend/src/zombies/zombie_wave_engine.pure.lib.ts`
  receives a plain `cockingMs` through `WaveConfig` and must not import the
  weapon catalog. An upgrade only changes which number gets passed in.
- **Scoring hooks:** the wave engine records `HitZone` (`'head' | 'body'`) on
  every hit "for a future scoring system (headshots are intended to be worth
  more points)". With `wrongShots`, time taken, and an unused second shot,
  that's enough to score a wave. Zombie Horde's scoring
  (`frontend/src/horde/horde_scoring.pure.lib.ts`) is the pattern to copy.

### PRD guardrail

`PRD_adaptive_learning_games.md` §"Rewards, kept healthy": rewards "tuned to
motivate without dark patterns". No daily-login bonuses, streak penalties,
timed offers, or grind. Prices reachable in a handful of good sessions.

## Scope

In scope:
- A pure, tested scoring function for an Outbreak session (right answers,
  headshots, unused second shots, maybe speed), in `src/outbreak/`, not in
  the wave engine.
- Banking the session's points to the armory ledger at the end of a session
  (win or game over), and showing "points earned" on the end screen.
- Reload upgrades for Outbreak. Suggested tiers, to tune: 900ms (free) →
  ~600 → ~300 → 0ms. See the open question about reusing the Horde blasters.
- A small panel on Outbreak's start screen (`phase === 'start'` in
  `src/outbreak/zombie_arena.effect.ui.tsx`) showing the balance and the
  reload options. Not a new shop screen unless the user wants one.
- Making zero reload work end to end, gameplay *and* animation (see step 4).

Out of scope:
- Any change to Outbreak's rules (health, hit zones, shots per wave).
- Bullets, grenades, scopes in Outbreak.
- Points in games outside the two zombie games.
- Real-money anything.

## Starter instructions for Claude

1. Read `AGENTS.md`, `ideas/zombie-horde.md`, then
   `src/zombies/zombie_wave_engine.pure.lib.ts` (module docstring and
   `WaveState`), `src/blaster/weapon_definitions.pure.lib.ts`,
   `src/outbreak/zombie_arena.effect.ui.tsx`,
   `src/outbreak/zombie_math_blaster.assembly.main.ts`,
   `src/outbreak/arena_session.pure.lib.ts`, `src/horde/horde_scoring.pure.lib.ts`,
   `src/api/armory_api.effect.lib.ts`, and `backend/app/armory/`. Re-check the
   facts above.
2. Raise the open questions below with the user before writing code.
3. Scoring function and its tests first, before any UI.
4. **Handle `cockingMs: 0` deliberately; this is the trap.** The engine sets
   `cockingUntilMs = elapsedMs + cockingMs` and promotes to
   `'readySecondShot'` only on a later `tick`, so zero still costs one frame;
   add an engine test for the zero case. Separately,
   `computeVisualCockingProgress` (`src/blaster/blaster_pose.pure.lib.ts`)
   divides by the cocking window; zero or near-zero `cockingMs` can divide by
   zero or play a pump animation longer than the gate. Decide what zero reload
   looks like (likely: skip the pump, keep the recoil kick) and test it.
5. Backend: if the ledger needs a game id or an Outbreak round request, add it
   in `backend/app/armory/`, run `make gen-api`, update the zod adapter.
6. Wire the UI: balance, reload options, purchase, and the per-profile weapon
   through `bindZombieArena`'s `weapon` dep. Tests and stories per AGENTS.md.
7. Play it with `make dev`: a bought zero-reload upgrade should visibly let
   you fire both shots back to back, and the balance should match what Zombie
   Horde shows.

## Open questions

- **Reuse the Horde's blasters, or separate reload upgrades?** If a profile
  owns the Rapid or Mega Blaster from Zombie Horde, should Outbreak just use
  it (one purchase, both games)? Or does Outbreak get its own reload tiers?
  Rapid (350ms) and Mega (200ms) are close to the suggested tiers already,
  but neither is zero, and Mega's Horde damage boost means nothing in Outbreak.
- Point values and prices: a feel decision, worth one playtest together.
- Should Outbreak's points count toward Horde's personal best? (Probably not;
  see the `survived_ms` note above.)

## Related

- `ideas/zombie-horde.md`: the armory and ledger this spends from.
- `ideas/post-game-stats.md`: the end screen where "points earned" goes; both
  want the same per-wave data, so do that plumbing once.
