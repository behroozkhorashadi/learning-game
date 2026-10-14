# Starfort: a math tower defense game

**Status:** idea (playable throwaway prototype exists, see Context)

## Summary

A 2D top-down tower defense game for every age. Enemies march along a path
toward your base. You earn points only by answering questions, and you spend
them on towers and upgrades. Harder questions pay more. A wrong answer sends an
extra swarm, "I don't know" sends a smaller one. Waves get stronger, so you
need stronger towers. It uses the same progression model as Zombie Horde: an
in-game shop, badges, and unlocks that come from playing more.

## Context

- Came from a brainstorm on 2026-10-14. The user's own rules:
  - Answering questions gives points. Points buy defenses.
  - The kid chooses easier or harder questions.
  - The game pauses for a few seconds while you answer.
  - Wrong answer: an extra swarm. "I don't know": a smaller swarm. Right
    answer: points.
  - Waves get stronger and stronger, so you keep buying more powerful towers.
- **For all ages, not just the 6-year-old.** The 11-year-old has to find it
  challenging: hard questions (fractions, multi-step, solve for x) and strategy
  that matters (where to place towers, counters to enemy types, save or spend).
  Safety nets get weaker as difficulty goes up.
- Decisions made:
  1. **2D top-down.** The user wanted to see an example before committing. A
     throwaway single-file HTML prototype was built in the 2026-10-14 session:
     `ideas/tower-defense-prototype.html` (open it in a browser; also published
     as a private Artifact). The user liked it at a high level. It is a
     look-and-feel sketch, not code to port.
  2. **A new theme (space: "Starfort", Glorps attacking a Power Core), plus a
     Zombie version as an unlockable theme.** The Zombie theme keeps a fun
     look shared across games. Themes change art and names only. The rules
     stay the same.
  3. **Math only first.** Spelling must be easy to add later. The question
     source is a pluggable interface that the game never looks inside.

## Design

**Points come from questions, at a limited rate.** If questions were unlimited
between waves, a kid could buy everything before every wave and there would be
no pressure. So after each answer, the next question takes about 6 seconds of
unpaused play to recharge. Points per minute then depends on which difficulty
you pick, and that choice is the real decision. Killing enemies gives no points
(open question below).

| difficulty | points | answer time | wrong-answer swarm |
|---|---|---|---|
| Easy | 10 | 12 s | big |
| Medium | 20 | 12 s | big |
| Hard | 35 | 18 s | big |

"I don't know" and running out of time both bring a small swarm and show the
answer, as Zombie Horde does.

**Towers** (3 levels each, sell for 60% of what you spent):
Blaster (cheap, fast single shots), Frost Ray (slows), Rocket Pod (splash),
Laser (ignores armor). **Enemies:** crawler, runner (fast), tank (armored),
boss every 5th wave. Enemy health grows about 13% per wave.

**Between games:** clearing a wave earns stars. Stars are the long-term currency
for unlocks: new maps, new tower types, hero units, the Zombie theme, base
skins. Badges for waves survived, answer streaks, and finishing on hard.

## Scope

In scope (v1):
- One map, four towers, four enemy types, endless waves, and the question
  economy described above, with math questions only.
- The question source as an interface (`ask(difficulty) -> Question`, then
  check the answer), so spelling can be added later without touching the game.
- Stars, at least one unlock (the Zombie theme), and a best wave per
  difficulty.
- **First, move Zombie Horde's progression pieces into a shared feature** (the
  points ledger, the shop catalog, and unlocks/prizes) so this game and later
  ones can use them.

Out of scope (v1): spelling questions, more than one map, hero units, flying
enemies, parent settings for this game.

## Starter instructions for Claude

1. Read `AGENTS.md`, `frontend/src/horde/AGENTS.md` (if present), and copy the
   shape of `frontend/src/examples/todo/`.
2. Read how Zombie Horde does progression: `frontend/src/horde/horde_armory.pure.lib.ts`,
   `armory_shop.pure.ui.tsx`, `art_studio.effect.ui.tsx`, the backend
   `backend/app/armory/` and `backend/app/badges/`, and the game registration in
   `backend/app/play/games/zombie_horde_reducers_pure.py`.
3. Read the question generators: `frontend/src/horde/horde_question.pure.lib.ts`
   and the tiers in `backend/app/play/games/fact_fluency_reducers_pure.py`.
   Hard questions here need fractions and multi-step problems, which those tiers
   don't have yet.
4. Propose the shared-progression extraction as its own PR before building the
   game.
5. Build the engine as pure libs (`td_engine.pure.lib.ts`, `td_waves.pure.lib.ts`,
   `td_towers.pure.lib.ts`) with a balance simulation test like
   `horde_balance.pure.lib.test.ts`. Use a fixed time step and an injected RNG,
   so it is deterministic.
6. Draw the map on a `<canvas>` from a hook, with the rendering kept out of
   React state.
7. Add the game to `docs/architecture/3-frontend.mmd`.

## Open questions for the user

- Should running out of time count as "I don't know" (small swarm), or as
  wrong (big swarm)? The prototype treats it as "I don't know".
- Should killing enemies give a few points, or should points only come from
  questions? The prototype gives none.
- Should the game also interrupt with a question every so often, or only when
  the kid presses the button?
- Multiple choice (prototype) or typed answers? Typed is better practice for the
  older kids. It could be an option per profile.
- How many stars should the Zombie theme cost?
