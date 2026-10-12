# Zombie Horde: a new free-roaming zombie math game with health, lives, and a points-funded armory

**Status:** in-progress: phases 1–3 built on `feat/zombie-horde` (2026-10-11), new animation art still to do

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

Still to do:
- Real fall, crawl, get-up, crouch, and sidestep clips (Meshy or Mixamo); the
  roles exist and today borrow `Dead` (played backwards to get up) and `Running`.
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
`ideas/points-and-upgrades.md`. They decided the health/weapon/bullet half of
that idea belongs in a **new** game rather than bolted onto Equation Outbreak:
"it's a whole new game... I don't want to pollute the old game. We should
maintain the old game."

That decision also dissolves the open conflict in `points-and-upgrades.md`
phase 2 (multi-hit health vs. Outbreak's "exactly two shots per wave" rule):
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
- A saved per-profile balance. Where it lives is the same open question as
  `points-and-upgrades.md` step 2. Ask, don't guess.
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

### Out of scope

- Destructible or respawning cover (user: "later if ever").
- Any change to Equation Outbreak's gameplay.
- Points or upgrades in other games.
- Player movement (assumed stationary with aim, like Outbreak; confirm).
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
2. Raise the open questions below with the user before writing engine code.
3. Write the pure engine and its tests first. No React, no three.js.
4. Then the scene, the feature component (`bindHorde`), and the assembly.
   Register the game in `src/main/app.assembly.main.ts` (and the dev screen
   picker in `src/main/dev_screens.assembly.main.ts`).
5. Stories for every UI file. Keep `useFrame` allocation-free (see
   `AGENTS.md` Performance; this is a 3D scene).
6. Draw the new folder in `docs/architecture/3-frontend.mmd`, then run
   `python3 docs/architecture/build.py`.
7. Play it with `make dev` before calling a phase done.

## Open questions

- Does a zombie reaching the player cost a life? Then what happens to that
  zombie (knocked back, or replaced)?
- Lives: 2 or 3? Can a thrown object be avoided (e.g. shot down), or does it
  always land?
- Can the player turn or move, or stay in one spot and aim like Outbreak?
  A "much larger area" may need at least a wider field of view or turning.
- Damage numbers: e.g. zombie health 3, headshot 3, body 2, leg 1 plus a
  knockdown. A feel decision, to tune together.
- Grenade rule: does it only count near the correct zombie, or does it only
  slow zombies rather than damage them? It must not let a kid skip the math.
- Does a wrong shot also cost points, or is the thrown object penalty enough?
- Final name of the game.

## Related

- `ideas/points-and-upgrades.md`: its phase 1 (points + reload for Outbreak)
  stands on its own. Its phase 2 (health, weapon and bullet catalog) moves
  here. The points balance and its storage should be shared by both games,
  so decide its storage once.
- `ideas/post-game-stats.md`: the end screen is the natural place for stats.
