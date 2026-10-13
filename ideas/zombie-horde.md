# Zombie Horde: a new free-roaming zombie math game with health, lives, and a points-funded armory

**Status:** in-progress: phases 1–3 built (2026-10-11), overtime built (2026-10-12); new animation art and phase 4 (the 10-zombie horde, ducking, scopes) still to do

## What was built (2026-10-11)

- Backend: `zombie_horde` game (Fact Fluency's facts and tiers under its own id,
  `app/play/games/zombie_horde_reducers_pure.py`) and `app/armory/`: an
  append-only points ledger with the catalog and prices
  (`GET /api/profiles/{id}/armory`, `POST …/armory/rounds`, `POST …/armory/purchases`).
- Frontend `src/horde/`: a pure engine (`horde_engine.pure.lib.ts`), the
  armory's in-play numbers (`horde_armory.pure.lib.ts`), scoring, the R3F scene,
  HUD, start screen with the armory shop, results, the round hook, and the
  assembly; on the kid home next to Equation Outbreak.
- Shared: four new clip roles in `src/zombies/` (`walk`, `dodge`,
  `knockedDown`, `getUp`; `getUp` plays the fall backwards). Outbreak unchanged.

Defaults chosen for the open questions below (all tunable constants):
- A zombie reaching the player costs a life, then leaves and is replaced at the back.
- 3 lives; a thrown object always lands (1.1s flight).
- The player stays in one spot and aims (fixed camera, wide view).
- Damage out of 100 health: starter gear is head 1 hit, body 2, leg 3 (and
  a knockdown). Rapid/Mega blasters scale damage ×1.15/×1.35 and reload in
  0.35s/0.2s; armor-piercing and explosive rounds raise body and leg damage.
- A grenade only goes off if the zombie with the right answer is within
  2.6m; then it hits everything in reach and solves the question. Otherwise
  it fizzles (and is still spent). Every profile starts with one grenade;
  packs of 3 cost 80.
- A wrong shot never costs points; losing a life is its cost. Points: 5 per
  right answer, 15 per defeat, 5 per headshot, 50 for surviving, 10 per life left.
- Prices: Rapid Blaster 250, Mega 600, Armor-Piercing 200, Explosive 500.
- Name: Zombie Horde.

Added after the first playtest (2026-10-11):
- Push back: 3 per round (✋ or F), knocks any zombie back with no penalty.
- The right-answer zombie never hides; zombies no longer wedge against cover.
- Damage: 2 headshots / 4 body / 5 leg with starter gear; a hit knocks back a little.
- Special rounds are consumable packs of 25 (armor-piercing 60, explosive 120); standard rounds never run out.
- Art Studio (300 points): selfie → AI art in one of four styles (+ an idea), kept in a per-profile gallery.
  Points are charged only once the art is made; it needs the OpenAI key the profile photo remix uses.

Balance pass from replayed playtests (2026-10-11):
- Walking speed no longer follows the server's level (that made levels 9-10 unwinnable even
  with perfect aim): 54s to cross at level 1, 45s at the top; the speed-up over a round is 20%.
- Push-back: the space bar (or ✋) sends the closest zombie all the way to the back, once a round.
  More than one made the round unlosable. horde_balance.pure.lib.test.ts simulates rounds and
  pins this: answering every 6s survives ~95%, every 20s loses.

Overtime (2026-10-12, commit `eaf1cff`):
- Beating the 60s clock no longer ends the round. Zombies keep speeding up
  (`OVERTIME_RAMP`, no cap) until they get through; even perfect play is overrun
  within ~4 minutes (`horde_balance.pure.lib.test.ts`). The player can stop and
  bank at any time in overtime.
- Overtime earns 2 points a second; beating the personal best earns 100. The best
  is the longest round, a `survived` armory ledger entry (`best_survived_ms`),
  shown on the start screen, the overtime HUD, and the results.

Still to do:
- Real fall, crawl, get-up, crouch, and sidestep clips (Meshy or Mixamo); the
  roles exist and today borrow `Dead` (played backwards to get up) and `Running`.
- Phase 4 below: the real horde in overtime, heavy ducking, and scopes.
- Destructible cover (out of scope, per the user).
- Playtest the numbers with the kid.

## Summary

A second zombie game, separate from Equation Outbreak. Three or four zombies
roam a large open area, weaving between cover and advancing on the player.
One math problem shows at a time, each zombie carries an answer, and the
player shoots the zombie with the right one. Zombies have health: headshots
do the most damage, leg shots knock a zombie down to crawl. A round lasts 60
seconds against an endless horde (a killed zombie is replaced from the back),
so there are always 3–4 answers to choose from. Points earned buy better
weapons, bullet types, and grenades.

## Context

This came from the user (the kid's parent) while reviewing
`ideas/points-and-upgrades.md` (now `outbreak-points-and-reload.md`). They
decided the health/weapon/bullet half of that idea belongs in a **new** game rather than bolted onto Equation Outbreak:
"it's a whole new game... I don't want to pollute the old game. We should
maintain the old game."

That decision also dissolved the open conflict in that file's old phase 2 (multi-hit health vs. Outbreak's "exactly two shots per wave" rule):
this game has no per-wave shot limit, so health just works.

### Decisions already made with the user (2026-10-11)

1. **Ending: endless horde, survive 60 seconds.** When a zombie dies a new
   one enters from the far side, so the player always chooses among 3–4
   answers. (Rejected: fixed waves and "kill all but the last one", because
   the choice shrinks to a coin flip at 2 zombies.)
2. **A wrong shot: the zombie dodges and throws something back.** The
   player has lives (`n` = 2 or 3, to tune) and loses one per throw that
   lands. A zombie reaching the player presumably also costs a life (confirm,
   see open questions).
3. **Leg shots knock a zombie down to crawl slowly for a while**, then it
   gets up. User's own concern, to be designed for: a downed zombie is lower
   and harder to hit, and it still has to be part of the answer set.
4. **Destructible-and-respawning cover: later, if ever.** Ship with fixed
   cover.
5. **The armory:** weapons (damage, fire rate), bullets (damage per zone,
   e.g. armor-piercing raises body-shot damage), and grenades (limited per
   round, more bought with points). All bought with points from play.

### How zombies are drawn and moved today (verified 2026-10-11)

- **Models:** four Meshy AI GLBs in `frontend/public/models/zombies/`
  (scientist, hockey, skater, sporty), registered in
  `src/zombies/character_definitions.pure.lib.ts`. All four share one
  24-bone skeleton (`Hips`, `LeftUpLeg`, `Head`, …), so one animation clip
  retargets to all of them.
- **Clips already embedded in every model:** `Walking`, `Running`,
  `Mummy_Stagger`, `Hit_Reaction`, `Dead`, `dying_backwards`,
  `Happy_Sway_Standing`, `Right_Hand_Sword_Slash`. The scientist also has
  `Basic_Jump` and `Sleep_Normally`. Clip roles live in
  `CharacterAnimationClips` (`idle`, `approach`, `hitReact`,
  `deadHeadshot`, `deadBody`, `reach`), with fallback rules in
  `zombie_animation_fallback.pure.lib.ts`.
- **Position is code, not animation.** The game moves the whole zombie by
  its outer group transform. `zombies/root_motion.pure.lib.ts` deliberately
  strips horizontal root motion from clips. In Outbreak the position comes
  from `arena/lane_navigation.pure.lib.ts` (straight lanes) and
  `zombie_wave_engine`'s 0..1 `distance`. This game needs 2D positions on
  an open field instead.
- **Hit zones:** `arena/use_zombie_hit_target.pure.hook.ts` decides head vs.
  body by whether the hit point is above the head bone. `HitZone` is
  `'head' | 'body'`, defined in `zombie_wave_engine.pure.lib.ts`. A leg zone
  is a similar split below the `Hips`/`LeftUpLeg` bone.
- **Cover already blocks shots:** environment colliders carry
  `raycastKind: 'environment'` (`arena/raycast_tags.pure.lib.ts`,
  `science_fair/environment_colliders.pure.lib.ts`).

### What each wanted movement needs

| Movement | How | New art? |
|---|---|---|
| Roam left/right, advance on the player | Steering on an open field (seek the player, avoid cover), play `Walking`, face the direction of travel | No |
| Hide behind cover | Steering target is a cover point; pause there; cover already blocks shots | No |
| Dodge a wrong shot | Quick lateral move driven by code; play `Hit_Reaction` or a sidestep clip | No for v1 (sidestep clip is nicer) |
| Throw something back | `Right_Hand_Sword_Slash` as a stand-in throw, plus a projectile | No for v1 |
| Knocked down by a leg shot → crawl → get up | Needs fall, crawl, and get-up clips. Stopgap: part of `Dead`/`dying_backwards`, then `Mummy_Stagger` | **Yes** for a good result |
| Squat / stand up | Needs crouch and stand clips | **Yes** |

New clips can come from Meshy's animation library (the models' source) or
Mixamo retargeted to this skeleton. Because the skeleton is shared, each
clip is added once and works for all four characters.

### PRD guardrail

`PRD_adaptive_learning_games.md` §"Rewards, kept healthy": no daily-login
bonuses, streak penalties, timed offers, or grind. Prices should be
reachable in a handful of good sessions. Losing all lives ends the round
early but still banks the points earned.

## Scope

New feature folder(s), working name `horde` (rename freely). **Outbreak is
not modified**: `src/outbreak/` and `src/zombies/zombie_wave_engine.*` stay
as they are. Shared pieces are reused by import: zombie characters, rig, and
answer labels (`src/zombies/`), the weapon (`src/blaster/`), hit detection
(`src/arena/`), environment props (`src/science_fair/`), and question
generation (`src/outbreak/fact_fluency_brain.effect.lib.ts`, or whatever the
generator is; check). If a shared piece needs a new option (e.g. a leg hit
zone), add it so Outbreak's behavior is unchanged and its tests still pass.

### Phase 1: playable game, no new art

- A pure engine (`horde_engine.pure.lib.ts` or similar), fully unit-tested
  before any 3D: zombie 2D positions and velocities, steering toward the
  player around cover, health, the current question and answer assignment,
  the 60-second clock, lives, respawn on kill, and dodge/throw on a wrong
  shot. Deterministic: time and randomness are injected.
- Question cycle: one question at a time; a correct hit damages that zombie,
  then a new question appears and answers reshuffle across zombies. Health
  carries over between questions.
- Head and body hit zones with different damage (data, not constants).
- Fixed cover in a larger arena.
- HUD: question, timer, lives, a health bar per zombie.
- An end screen (win: survived 60s; lose: out of lives).

### Phase 2: points and the armory

- Scoring per round (kills, headshots, accuracy).
- A saved per-profile balance (built: the backend ledger in `app/armory/`).
- A shop/loadout panel on the start screen. Catalog as data: weapons
  (damage, fire rate), bullets (damage per zone), grenades (count, radius).
- Grenade rule that can't skip the math (see open questions).

### Phase 3: leg shots and new animations

- Leg hit zone. A leg shot knocks the zombie down: it crawls slowly for a few
  seconds, then gets up.
- New clips (fall, crawl, get up, maybe crouch and sidestep) through Meshy or
  Mixamo, registered as new roles in `CharacterAnimationClips`.
- Downed-zombie targeting: keep its answer and give it a larger invisible hit
  collider so it isn't frustrating to hit low to the ground. Answer label
  drops with it but stays readable.

### Phase 4: overtime becomes a horde, zombies duck, scopes in the armory

Requested by the user on 2026-10-11 after the first playtests: "once you get
past 60 seconds, it really starts to become a horde ... it sort of almost
becomes a little bit of a mess. Maybe we can get up to 10 zombies. I want them
to start moving differently, like ducking behind stuff, almost to the degree
where it gets annoying." Scopes are the counter: the far end of a longer
hallway is hard to read and hit without zooming.

Overtime itself already exists (above): the round keeps going and speeds up.
What's missing is everything that makes it a *horde*.

**What stands in the way today** (verified 2026-10-12; re-check):

- **The zombie count is fixed at 4** (`ZOMBIE_COUNT` in
  `src/horde/horde_engine.pure.lib.ts`), and many things assume it:
  - `SLOT_CENTRES = [-0.66, -0.22, 0.22, 0.66]`: each slot wanders its own
    share of the field's width.
  - `setQuestion` deals the question's options onto the first `ZOMBIE_COUNT`
    slots and makes sure the right answer is on a live zombie.
  - The assembly picks a roster with
    `pickSessionRoster(ZOMBIE_CHARACTER_REGISTRY, ZOMBIE_COUNT, Math.random)`
    (`src/zombies/zombie_roster.pure.lib.ts`), which **throws if there are
    fewer enabled characters than the roster size**. There are 4 character
    models, so 10 zombies need repeats (maybe tinted or scaled to tell apart).
- **Answers:** the backend sends **4 options** per question (1 right + 3
  distractors, `backend/app/play/games/fact_fluency_reducers_pure.py`;
  `horde_question.pure.lib.ts` requires at least 4). With 10 zombies, 6 have
  no answer unless something changes.
- **Hallway length:** `SPAWN_DEPTH = 19`, `CONTACT_DEPTH = 1.4`, and the field
  narrows toward the camera (`maxAbsX`), in `src/horde/horde_field.pure.lib.ts`.
  Cover is a fixed list (`COVER`, six pieces from depth 7 to 16.5) with a
  comment on gap widths so zombies can't wedge. The floor and back wall in
  `horde_environment.pure.ui.tsx` size off `SPAWN_DEPTH`.
- **Hiding:** `HIDE_CHANCE = 0.55`, hide for 1.4–2.8s, a 7s cooldown, only
  with cover within `HIDE_BAND` in front. The right-answer zombie **never
  hides**. Keep that in overtime, or "annoying" becomes unwinnable; the decoys
  are the ones that should duck a lot.
- **Camera:** fixed at `CAMERA_POSITION = [0, 1.7, 2.2]`, fov 56
  (`horde_scene.pure.ui.tsx`). No zoom.
- **Perf:** 10 skinned, animated zombies is 2.5× today's load. Measure before
  and after (AGENTS.md, Performance), keep `useFrame` allocation-free, and check
  the story still runs.

**In scope:**

1. *The horde.* Overtime escalates in stages, e.g. every 15s: +1 or +2
   zombies, the spawn point moves back. Cap at about 10. A table of stages
   (data, not scattered constants) so it's easy to tune after a playtest.
   Replace the 4 fixed slots with lanes derived from the count.
2. *A longer hallway.* Either the field grows in overtime, or the hall is long
   from the start with zombies spawning nearer for the first 60s (simpler
   than geometry that changes mid-round). More cover further back, following
   the gap rule. Answer labels must stay readable at the far end, at least
   with a scope.
3. *Ducking.* In overtime, decoys hide much more: higher `HIDE_CHANCE`,
   shorter cooldown, popping up and down behind low cover, running from one
   piece of cover to the next, maybe a crouch in place. Wants the crouch and
   sidestep clips from "Still to do"; stopgap: lower the model, as hiding does
   today.
4. *Scopes.* A new armory catalog kind, e.g. a **2×** and a **3×** scope.
   Zoom by narrowing the fov (56 → 28 for 2×, ~19 for 3×) while aiming down
   the scope, centred on the aim point: hold right-click or a key, plus an
   on-screen button for touch (accessible names). A scope overlay (circle
   vignette, crosshair) in the HUD while zoomed. Shooting must still raycast
   correctly from the zoomed camera (`horde_raycast.pure.lib.ts`). Backend:
   add the items to `backend/app/armory/`, run `make gen-api`, update the zod
   adapter.
5. *Balance.* Extend `horde_balance.pure.lib.test.ts` to cover the horde
   stages; it pins winnability today and must keep doing so.

**Open questions for phase 4** (ask before writing code):

- **Extra zombies' answers:** (a) ask the backend for more distractors for
  `zombie_horde` (every zombie stays meaningful), (b) extra zombies carry no
  number (pure threats to shoot or push back; the messiest horde and the
  simplest), or (c) repeat wrong answers.
- **How annoying is annoying?** Should ducking ever hide the right answer,
  even briefly? (Today: never.)
- **Scope controls:** hold or toggle? Which key? Does the 3× replace the 2×,
  or can you switch?
- **Scope prices**, and is a scope needed to make the long hall fair (then the
  starter loadout may need a basic 1.5×) or just a nice upgrade?
- Does the longer hall exist from the start, or grow in overtime?

**Phase 4 order:** engine first, pure and tested (N zombies, stages, longer
field, overtime hiding, balance sim); then scopes (catalog + `make gen-api`,
loadout, zoom, HUD overlay, stories); measure frame time with 10 zombies; play
it with `make dev`; record what was built at the top of this file.

### Out of scope

- Destructible or respawning cover (user: "later if ever").
- Any change to Equation Outbreak's gameplay.
- Points or upgrades in other games.
- Player movement (the player stays in one spot and aims).
- Real-money anything.

## Starter instructions for Claude

1. Read `AGENTS.md`, then the shared pieces this game reuses:
   `src/zombies/character_definitions.pure.lib.ts`,
   `src/zombies/zombie_character_3d.pure.ui.tsx`,
   `src/zombies/use_zombie_rig.pure.hook.ts`,
   `src/arena/use_zombie_hit_target.pure.hook.ts`,
   `src/arena/raycast_tags.pure.lib.ts`, `src/blaster/weapon_definitions.pure.lib.ts`,
   and Outbreak's wiring for reference (`src/outbreak/zombie_arena.effect.ui.tsx`,
   `src/outbreak/zombie_math_blaster.assembly.main.ts`). Re-verify the
   "Context" facts above; they may be stale.
2. For new work, raise that phase's open questions with the user before writing engine code.
3. Write the pure engine and its tests first. No React, no three.js.
4. Then the scene, the feature component (`bindHorde`), and the assembly.
   Register the game in `src/main/app.assembly.main.ts` (and the dev screen
   picker in `src/main/dev_screens.assembly.main.ts`).
5. Stories for every UI file. Keep `useFrame` allocation-free (see
   `AGENTS.md` Performance; this is a 3D scene).
6. Draw the new folder in `docs/architecture/3-frontend.mmd`, then run
   `python3 docs/architecture/build.py`.
7. Play it with `make dev` before calling a phase done.

## Open questions (phases 1–3)

All answered; see "Defaults chosen" at the top. Phase 4's open questions are
in its own section.

## Related

- `ideas/outbreak-points-and-reload.md`: points and a faster reload for
  Equation Outbreak, spent from this game's armory ledger.
- `ideas/post-game-stats.md`: the end screen is the natural place for stats.
