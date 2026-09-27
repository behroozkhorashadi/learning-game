# Point system with buyable upgrades (starting with faster / zero reload)

**Status:** idea

## Summary

Give the player points for playing well, and let them spend those points on
upgrades that change how the game feels. The first and most motivating
upgrade: a faster reload — and at the top tier, *zero* reload, so both shots
of a wave can be fired back-to-back.

## Context

This came from the user (the kid's parent) as a motivation lever: the game
already tracks everything needed to score a round, but nothing is ever
awarded, spent, or persisted, so there's no reason to play well beyond the
round itself.

Two parts of the codebase were already written in anticipation of exactly
this, and should be the anchors rather than reinvented:

- **Scoring hooks already exist, unused.** `lib/zombieWaveEngine.ts` records
  `HitZone` (`'head' | 'body'`) on every carrier and on `lastHit` purely as
  classification data — its docstring says outright that it's preserved
  "for a future scoring system (headshots are intended to be worth more
  points)." Hits are one-shot defeats regardless of zone today; the zone
  only picks a death animation and `resolutionReason`. That's the natural
  first scoring input, alongside `wrongShots`, `elapsedMs`, and
  `shotsRemaining` (an unused second shot is a clean "efficiency" bonus).
- **The weapon abstraction already anticipates a catalog.**
  `lib/weaponDefinitions.ts` defines a typed `WeaponDefinition` with
  `unlockCost` and `unlockedByDefault` fields that nothing reads yet, and
  its docstring explains the shape "anticipates a future unlockable weapon
  catalog." Only `STARTER_BLASTER` exists (`cockingMs: 900`,
  `unlockCost: 0`).

**Why reload is the right first upgrade.** A wave is exactly two shots, and
`cockingMs` is described in `weaponDefinitions.ts` as "the sole gate on the
second shot." So reload speed is the single highest-leverage number in the
game: lowering it directly buys the player more time to think on their
second attempt, and zero reload means a wrong first shot costs only the
speed boost, not the clock. It's also a genuinely *learning-positive*
upgrade — the reward for doing well is more thinking time, not a way to skip
the math.

**The architectural constraint that matters most.** The pure engine
(`zombieWaveEngine.ts`) must not learn about weapons or upgrades. Its
docstring and `weaponDefinitions.ts`'s both state the rule: the engine
receives a plain numeric `cockingMs` via `WaveConfig` and "does not import
this module, and must not." An upgrade therefore changes *which number the
React layer passes in*, nothing else. Mirrors the backend's own
pure-engine/stateful-service split (`app/engine/loop_a.py` vs.
`app/services/loop_a_service.py`).

**Nothing reward-shaped is persisted today.** `components/SessionComplete.tsx`
says so explicitly: "Rewards aren't persisted anywhere yet (no backend model
for it), so this is a celebratory one-off shown at the end of the current
session only." A points balance is the first thing in this app that has to
actually survive a session, so it needs a real decision about where it lives
(see open questions).

**PRD guardrail — read before designing the economy.**
`PRD_adaptive_learning_games.md` §"Rewards, kept healthy" requires rewards
"tuned to motivate without dark patterns. Session caps. No pressure
mechanics designed to extend engagement past what a parent wants." A points
economy is the single easiest place in this repo to accidentally violate
that. Concretely: no daily-login bonuses, no streak-loss penalties, no
timed/limited-time offers, no grind so long that the only way to progress is
more play time. Prices should be reachable in a handful of good sessions.

## Scope

In scope:
- A scoring function — pure and unit-tested, in `lib/` alongside the wave
  engine, not inside a component — turning one resolved wave into points.
  Inputs it should consider: correct/incorrect, hit zone (headshot worth
  more, per the engine's existing intent), `wrongShots`, whether the second
  shot went unused, and time taken.
- A persisted per-profile points balance (earned total and spent total, or
  balance + ledger — see open questions).
- An upgrades catalog with the reload tiers as the first entries, expressed
  as data (same spirit as `WEAPON_DEFINITIONS`), not hardcoded branches.
  Suggested tiers, to be tuned in playtesting: 900ms (default, free) →
  ~600ms → ~300ms → 0ms.
- A place to spend points. Simplest version: a panel on the game's start
  screen (`ZombieArena`'s `'start'` phase) showing the balance and the
  buyable upgrades — not a whole new shop screen unless the user wants one.
- Wiring the purchased reload tier through to gameplay. The chokepoint is
  `const WEAPON = STARTER_BLASTER` at module scope in
  `games/framework/ZombieArena.tsx`, read by `buildWaveConfig` and passed to
  `EquationBlaster` — that's what has to become per-profile state.
- Making the zero-reload case actually work end to end, gameplay *and*
  animation (see starter instructions step 4 — this is the one real
  landmine).

Out of scope:
- New weapons. The catalog fields (`unlockCost`, `unlockedByDefault`) exist
  and buying a whole new blaster is the obvious sequel, but modeling a
  second weapon means new GLB assets and a new pose config — don't take that
  on here.
- Cosmetics, skins, currencies beyond the single point type.
- Extending points to the other games (Pathfinder, Syllable Builder, etc.).
  Get the loop right in one game first. Do keep the persistence model
  game-agnostic enough that it isn't painful later.
- Anything resembling real-money purchase UI. Obviously.

## Starter instructions for Claude

1. Read, in this order: `lib/zombieWaveEngine.ts` (especially the module
   docstring and `WaveState`), `lib/weaponDefinitions.ts`,
   `games/framework/ZombieArena.tsx` (`buildWaveConfig`, the `WEAPON`
   constant, the `'start'` phase render), `games/framework/zombieArenaTypes.ts`,
   and `components/EquationBlaster.tsx` (`computeVisualCockingProgress`).
   Confirm the details in Context above still hold — this file may be stale.
2. **Ask the user where the balance should live before writing persistence
   code.** The two real options: (a) `localStorage`, matching how
   `lib/pathfinderProgress.ts` and `lib/pathfinderCustomMaps.ts` already
   store per-player progress client-side — fast, no migration, but lost on a
   browser/device change; (b) a real backend model + endpoints, consistent
   with `Profile`/`Attempt`/`BadgeAward`, surviving devices and visible to
   the admin screen. Note for the user when asking: the app's own
   `ProfileStats` precedent (`backend/app/models/stats.py`) is to *derive*
   read-models live from the event log rather than store them — but a
   *spent* balance can't be derived from attempts alone, so a purchases
   table (deriving balance as `earned − spent`) is the option that best
   matches the existing "log events, don't mutate-and-reconstruct" rule
   stated in `models/item.py`. Don't guess between these; the answer changes
   most of the work.
3. Write the pure scoring function and its tests first, before any UI. Put
   it in `frontend/src/lib/` with a `.test.ts` beside it, matching
   `zombieWaveEngine.test.ts`. Do **not** add scoring logic into
   `zombieWaveEngine.ts` itself — keep the engine's existing responsibility
   boundary intact.
4. **Handle `cockingMs: 0` deliberately — this is the trap.** The engine
   sets `cockingUntilMs: wave.elapsedMs + config.cockingMs` and promotes to
   `'readySecondShot'` only in a later `tick` when
   `elapsedMs >= cockingUntilMs`. With `cockingMs: 0` that promotion still
   costs one frame, which is fine for gameplay but should be verified, not
   assumed — add an explicit engine test for the zero case. Separately,
   `computeVisualCockingProgress` (`components/EquationBlaster.tsx`) divides
   by the cocking window and is driven by `recoilSettleMs` from
   `recoilDurationMs: 260`; a zero or near-zero `cockingMs` can produce a
   divide-by-zero or a reload animation longer than the gate it represents.
   `EquationBlaster.test.ts` already covers a `recoilSettleMs` of 0 but not
   a `cockingMs` of 0. Decide and state what the weapon should visually do
   with zero reload (likely: skip the pump animation, keep the recoil kick).
5. Only then wire the UI: balance display, catalog, purchase action, and
   replacing the module-scope `WEAPON` constant with per-profile state.
6. Add component tests alongside the existing ones in `games/framework/` and
   `games/` (see `ZombieArena.weaponTuning.test.tsx` for the pattern of
   testing arena wiring without booting Three.js).
7. Before calling it done, play it: a purchased zero-reload upgrade should
   visibly let you fire both shots back-to-back, and the balance should
   survive a page reload.
8. Raise with the user rather than guessing: the exact point values and
   upgrade prices (these are a *feel* decision and worth one round of
   playtesting together), and whether the reload tiers should be presented
   as upgrades to the existing blaster or as separate weapons in the
   catalog.

## Related

- `ideas/post-game-stats.md` — the stats screen is the natural surface to
  show points earned this session, and both ideas want the same per-wave
  data. Worth reading both before starting either; if they're built in the
  same session, do the shared telemetry work once.
