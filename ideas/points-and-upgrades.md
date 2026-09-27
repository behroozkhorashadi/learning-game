# Point system with buyable upgrades: reload speed, zombie health/hit-zones, and a weapon+bullet catalog

**Status:** idea

## Summary

Give the player points for playing well, and let them spend those points on
upgrades that change how the game feels. Three upgrade lines, all spending
from the same points balance:

1. **Faster reload** — and at the top tier, *zero* reload, so both shots of a
   wave can be fired back-to-back. (This is the original version of this
   idea and is the most-scoped-out section below — start here.)
2. **Zombie health and hit-zone damage.** Give each carrier a health bar
   instead of dying to any accepted hit: a headshot kills in 1 shot, a body
   shot takes 2, and an arm/leg shot takes 3. This is a bigger change than it
   sounds — see "Zombie health & hit-zone damage" below, including a real
   conflict with the engine's current "exactly two shots per wave" rule that
   has to be resolved, not glossed over.
3. **A weapon + bullet catalog to purchase.** Different guns (already
   anticipated by `WeaponDefinition`'s `unlockCost`/`unlockedByDefault`
   fields) and different bullet types (a new concept — e.g. armor-piercing
   rounds that reduce a body/limb shot's hit-count) as separate purchasable
   things, on top of the health/hit-zone mechanic above.

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

**Zombie health & hit-zone damage — the real design conflict to resolve
first.** The user asked for: a headshot kills in 1 shot, a body shot in 2,
and an arm/leg shot in 3. That's a genuine mechanic change, not just a
scoring tweak — `zombieWaveEngine.ts`'s `applyHit` currently defeats *any*
active carrier on the first accepted hit (its own docstring: "every accepted
shot — hit or miss — is a one-shot defeat"; `HitZone` only picks the death
animation and `resolutionReason`, never whether the hit kills). Making zone
determine a *hit count* instead of an instant kill means:
- `Carrier` needs a `remainingHits` (or `health`) field, initialized from
  its zone's required-hits count and decremented per accepted hit, only
  transitioning to `'defeated'` at 0 — a real change to `WaveState`/`Carrier`
  shape and to `applyHit`'s core branch, not an additive field nobody reads.
- **The conflict:** a wave today is a hard-coded exactly-two-shots contract
  (`shotsRemaining` starts at 2; the docstring calls this "one of the
  central simplifying rules"). If the *correct* carrier needs 2 shots (body)
  or 3 (limb) to go down, and only 2 shots exist in a wave at all, the
  player can't ever clear a body/limb-zone correct carrier without also
  guaranteeing a wrong-carrier hit or a wasted shot, or the wave has to stop
  being fixed-at-two-shots per zone. This has to be an explicit design
  decision with the user before writing engine code — candidates: shots per
  wave scale with the correct carrier's required hit-count; only headshots
  remain viable within a 2-shot wave and body/limb shots require multiple
  *waves* worth of hits (health persists across the approach?); or the
  "exactly two shots" rule is rethought entirely. Don't guess — this is the
  single riskiest unknown in this whole idea.
- Distractor (wrong-answer) carriers presumably keep needing only 1 accepted
  hit to remove from play regardless of zone (only the *correct* carrier's
  health should matter pedagogically — the exercise is picking the right
  carrier, not attrition-farming wrong ones), but confirm this with the user
  rather than assuming it.
- Whatever health values are chosen become new purchasable-catalog data (see
  the weapon+bullet catalog below), not hardcoded constants, matching how
  `cockingMs` already lives in `WeaponDefinition` rather than the engine.

**A weapon + bullet catalog, not just weapons.** `weaponDefinitions.ts`
already anticipates buyable *weapons* (`unlockCost`, `unlockedByDefault`) —
the previous version of this idea filed that under "out of scope, obvious
sequel," which no longer holds now that the user has asked for it directly.
New on top of that: *bullets* as a second, separate purchasable dimension —
e.g. a standard round needs the full zone hit-count, while a pricier
armor-piercing round reduces a body or limb shot's hit-count by one. That
means damage-per-zone can't live solely on the weapon; it's likely
`(weapon, bullet)` together that determines the effective hit-count per
zone, which should be modeled as data (a small lookup/formula), the same
"engine takes plain numbers, never imports the catalog" rule the reload
upgrade already established.

**PRD guardrail — read before designing the economy.**
`PRD_adaptive_learning_games.md` §"Rewards, kept healthy" requires rewards
"tuned to motivate without dark patterns. Session caps. No pressure
mechanics designed to extend engagement past what a parent wants." A points
economy is the single easiest place in this repo to accidentally violate
that. Concretely: no daily-login bonuses, no streak-loss penalties, no
timed/limited-time offers, no grind so long that the only way to progress is
more play time. Prices should be reachable in a handful of good sessions.

## Scope

This idea now covers two phases. Do phase 1 first — it's smaller, it's the
one already worked out in detail, and the points balance/catalog/purchase-UI
plumbing it builds is exactly what phase 2 spends. Don't start phase 2
before raising its open design conflict (health + the two-shots-per-wave
rule, above) with the user.

### Phase 1 — points + reload upgrade

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

Out of scope for phase 1 (see phase 2):
- New weapons and bullets, and the zombie health/hit-zone mechanic.
- Cosmetics, skins, currencies beyond the single point type.
- Extending points to the other games (Pathfinder, Syllable Builder, etc.).
  Get the loop right in one game first. Do keep the persistence model
  game-agnostic enough that it isn't painful later.

### Phase 2 — zombie health, hit-zones, and a weapon+bullet catalog

In scope:
- Per-carrier health/hit-count, replacing the engine's current one-shot-
  defeat rule for the *correct* carrier: 1 hit for a headshot, 2 for a body
  shot, 3 for an arm/leg shot (the user's numbers) — **only after** the
  two-shots-per-wave conflict above is resolved with the user, since it
  changes what "resolved" and "shots per wave" even mean. The health values
  should be data (baseline hit-counts, adjustable by weapon/bullet), not
  hardcoded in the engine.
- A weapon catalog beyond `STARTER_BLASTER`, purchasable via `unlockCost`
  (the field already exists and is already read by nothing).
- A bullet catalog: a purchasable second dimension that can reduce a body/
  limb shot's hit-count (e.g. armor-piercing rounds), separate from weapon
  choice.
- Wiring `(weapon, bullet)` selection through to gameplay, and a way to
  choose a loadout before a session (likely alongside the phase-1 upgrades
  panel).

Out of scope for phase 2:
- Cosmetics, skins, currencies beyond the single point type.
- Extending health/hit-zones or the weapon+bullet catalog to any other game.
- New GLB assets/animations for additional weapons unless the user wants to
  take that on explicitly — start with reskins or data-only variants
  (different `unlockCost`, `crosshairStyle`, `muzzleFlashStyle`, etc. on the
  existing model) before commissioning new art.
- Anything resembling real-money purchase UI. Obviously.

## Starter instructions for Claude

### Phase 1 — points + reload upgrade

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

### Phase 2 — zombie health, hit-zones, and a weapon+bullet catalog

1. **Do not write engine code before this conversation happens.** Bring the
   two-shots-per-wave conflict (Context, above) to the user explicitly, with
   the candidate resolutions listed there, and get a decision. This is the
   one thing in this file most likely to be stale or under-thought by the
   time someone picks it up — re-verify against the current
   `zombieWaveEngine.ts` rather than trusting this doc.
2. Once resolved, change `Carrier`/`WaveState` and `applyHit` in
   `zombieWaveEngine.ts` to track hit-count-to-defeat per carrier, and add
   engine tests for every zone at every hit-count (headshot-1, body-2,
   limb-3, plus whatever the wrong-carrier rule turns out to be).
3. Extend `WeaponDefinition` (or add a sibling `BulletDefinition`) with
   whatever data shape the `(weapon, bullet) -> hit-count-per-zone` decision
   above needs, and add a second catalog (`BULLET_DEFINITIONS`) alongside
   `WEAPON_DEFINITIONS` — keep the engine ignorant of both, exactly like
   `cockingMs` today.
4. A health bar needs new UI on each carrier — check whether
   `games/framework/` already has a place carrier-level UI/HUD elements are
   drawn (health isn't rendered anywhere today) before inventing a new
   layer.
5. Extend the phase-1 purchase panel to include weapons and bullets, and add
   a loadout choice before a session starts.
6. Play it: confirm a body-shot correct carrier now visibly takes 2 hits,
   an armor-piercing bullet (if built) visibly changes that count, and that
   the wave-resolution rule the user agreed to in step 1 behaves as decided
   when shots run out mid-health.

## Related

- `ideas/post-game-stats.md` — the stats screen is the natural surface to
  show points earned this session, and both ideas want the same per-wave
  data. Worth reading both before starting either; if they're built in the
  same session, do the shared telemetry work once.
