# Zombie Horde overtime: a real horde after 60 seconds, zombies that duck, and buyable scopes

**Status:** idea

## Summary

Once a Zombie Horde round gets past 60 seconds, it should turn into an actual
horde: the hallway gets longer, more and more zombies pour in (up to about
10), and it gets a bit chaotic. Zombies also start moving differently,
ducking behind cover often enough that it's almost annoying. To make the
longer hallway playable, add **scopes** to the armory that zoom the view 2×
or 3×, depending on which scope you bought.

## Context

Requested by the user (the kid's parent) on 2026-10-11, after the first
playtests of Zombie Horde (`ideas/zombie-horde.md`, built in `src/horde/`).
Their words: "once you get past 60 seconds, it really starts to become a
horde ... it sort of almost becomes a little bit of a mess. Maybe we can get
up to 10 zombies. I want them to start moving differently, like ducking
behind stuff, almost to the degree where it gets annoying." The scope is the
counter to that: the far end of a longer hallway is hard to read and hit
without zooming.

### What exists today (verified 2026-10-11; re-check, it moves fast)

- **Round length:** `ROUND_MS = 60_000` in `src/horde/horde_engine.pure.lib.ts`.
  Today 60s is the *win* condition: survive it and the round ends. So "past
  60 seconds" needs a decision about what overtime is (see open questions).
- **Zombie count is fixed at 4:** `ZOMBIE_COUNT = 4`, one zombie per roster
  slot. Many things assume 4:
  - `SLOT_CENTRES = [-0.66, -0.22, 0.22, 0.66]`: each slot wanders its own
    share of the field's width.
  - `setQuestion` deals the question's options onto the first `ZOMBIE_COUNT`
    slots and makes sure the right answer is on a live zombie.
  - The assembly picks a roster with
    `pickSessionRoster(ZOMBIE_CHARACTER_REGISTRY, ZOMBIE_COUNT, Math.random)`
    (`src/zombies/zombie_roster.pure.lib.ts`), which **throws if there are
    fewer enabled characters than the roster size**. There are 4 character
    models today, so 10 zombies need repeated characters (maybe tinted or
    scaled so they read as different).
- **Answers:** the backend sends **4 options** per question (1 right + 3
  distractors, `backend/app/play/games/fact_fluency_reducers_pure.py`, and
  `horde_question.pure.lib.ts` requires at least 4). With 10 zombies on the
  field, 6 have no answer unless something changes. Options:
  (a) ask for more distractors from the backend for `zombie_horde`,
  (b) extra zombies carry no number (pure threats: shoot them or push them
  back, but they don't solve anything),
  (c) repeat wrong answers. (a) keeps every zombie meaningful; (b) is the
  most "messy horde" and the simplest. Ask.
- **Hallway length:** `SPAWN_DEPTH = 19`, `CONTACT_DEPTH = 1.4`, the field
  narrows toward the camera (`maxAbsX`), all in `src/horde/horde_field.pure.lib.ts`.
  Cover is a fixed list (`COVER`, six pieces from depth 7 to 16.5) with a
  comment about gap widths so zombies can't wedge. The floor and back wall
  in `horde_environment.pure.ui.tsx` size off `SPAWN_DEPTH`. A longer hall
  means more cover further back, and the gap rule still applies.
- **Hiding today:** `HIDE_CHANCE = 0.55`, hide for 1.4–2.8s, a 7s cooldown,
  only when cover is within `HIDE_BAND` in front. The right-answer zombie
  **never hides** (added after the first playtest so the answer stays in
  sight). Keep that rule in overtime, or the "annoying" part becomes
  unwinnable; the decoys are the ones that should duck a lot.
- **Walking speed** no longer follows the server's level; it ramps 20% over
  the round (`SPEED_RAMP`). `horde_balance.pure.lib.test.ts` simulates
  rounds and pins winnability (answering every 6s survives ~95%). Any
  overtime must keep a version of that test passing.
- **Camera:** fixed at `CAMERA_POSITION = [0, 1.7, 2.2]` with fov 56
  (`horde_scene.pure.ui.tsx`). There's no zoom today.
- **Armory:** weapons, bullets, grenades in `src/horde/horde_armory.pure.lib.ts`,
  prices and the points ledger in `backend/app/armory/`. A scope is a new
  catalog item kind.
- **Perf:** `src/horde/` is a 3D scene. 10 skinned, animated zombies is 2.5×
  today's load: measure before and after (AGENTS.md, Performance), keep
  `useFrame` allocation-free, and check the story still runs.

## Scope

### 1. Overtime: the horde phase

- After 60s the round keeps going (if the user picks that; see questions)
  and escalates in stages, e.g. every 15s: +1 or +2 zombies, the spawn point
  moves back, speed creeps up. Cap at about 10 zombies.
- All of this as data (a table of stages), not scattered constants, so it's
  easy to tune after a playtest.
- Replace the 4 fixed slots with lanes that scale to N zombies
  (`SLOT_CENTRES` derived from the count).
- Respawns keep coming from the back, as today.

### 2. A longer hallway

- Make the field depth grow in overtime (or make the whole hall longer from
  the start, with zombies spawning nearer during the first 60s; simpler
  than geometry that changes mid-round).
- More cover further back, following the existing gap rule.
- Answer labels must stay readable at the new far depth, at least with a
  scope.

### 3. Ducking and dodging

- In overtime, decoy zombies hide much more: higher `HIDE_CHANCE`, shorter
  cooldown, pop up and down repeatedly behind low cover, run from one piece
  of cover to the next. Maybe a quick crouch-in-place even without cover.
- The right-answer zombie still never hides.
- Crouch/peek wants new animation clips (crouch, stand up, sidestep), the
  same clips already on the "still to do" list in `ideas/zombie-horde.md`.
  Stopgap: lower the model, as hiding does today.

### 4. Scopes (armory)

- New catalog kind: scope. Two to buy, e.g. **2× scope** and **3× scope**
  (prices to pick; the PRD says reachable in a handful of good sessions).
- Zoom by narrowing the camera's fov (56 → 28 for 2×, ~19 for 3×) while the
  scope is up, centred on the aim point. Hold right-click or a key (e.g.
  Shift or Z) to aim down the scope, plus an on-screen button for touch.
  Every control needs an accessible name.
- A scope overlay (circle vignette, crosshair) in the HUD while zoomed.
- Shooting must still raycast from the zoomed camera correctly
  (`horde_raycast.pure.lib.ts`).
- Backend: add the items to `backend/app/armory/` catalog and prices, run
  `make gen-api`, update the zod adapter.

### Out of scope

- Equation Outbreak (unchanged, as with the rest of Horde).
- Player movement.
- Destructible cover.

## Starter instructions for Claude

1. Read `AGENTS.md`, `ideas/zombie-horde.md`, then
   `src/horde/horde_engine.pure.lib.ts`, `horde_field.pure.lib.ts`,
   `horde_balance.pure.lib.test.ts`, `horde_armory.pure.lib.ts`,
   `use_horde_round.pure.hook.ts`, `horde_scene.pure.ui.tsx`, and
   `backend/app/armory/`. Re-check the facts above.
2. Ask the user the open questions below before writing code.
3. Engine first, pure and tested: N zombies, overtime stages, longer field,
   overtime hiding. Extend the balance simulation to cover overtime.
4. Then scopes: catalog (backend + `make gen-api`), loadout, zoom in the
   scene, HUD overlay, stories.
5. Measure frame time with 10 zombies before calling it done.
6. Update `ideas/zombie-horde.md` with what was built, and redraw
   `docs/architecture/` if dependencies change.
7. Play it with `make dev` (`?screen=` the horde dev screen).

## Open questions

- **What is overtime?** Today surviving 60s wins. Options: (a) at 60s you've
  "won" and banked the points, and you may keep going for bonus points until
  you run out of lives; (b) the round is simply longer (e.g. 120s) and the
  last half is the horde; (c) endless, score is how long you last.
- **Extra zombies' answers:** more distractors from the backend, numberless
  zombies, or repeated wrong answers?
- **How annoying is annoying?** Should ducking ever hide the right answer,
  even briefly? (Today: never.)
- **Scope controls:** hold to zoom, or toggle? Which key? Does the 3× scope
  replace the 2×, or can you switch between them?
- **Scope prices** and whether a scope is needed to make overtime fair or is
  just a nice upgrade (if needed, the starter loadout may need a basic 1.5×).
- Does the longer hallway exist from the start, or grow in overtime?

## Related

- `ideas/zombie-horde.md`: the game this extends, and its animation to-do
  list (crouch and sidestep clips).
- `ideas/points-and-upgrades.md`: the shared points economy.
