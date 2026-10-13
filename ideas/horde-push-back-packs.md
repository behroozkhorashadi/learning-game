# Zombie Horde: extra push-backs for sale in the armory

**Status:** idea

## Summary

Sell packs of extra push-backs in Zombie Horde's armory, bought with points
like grenades and special rounds. Every round still starts with its one free
push-back; a pack adds more that carry over until used. A way to make the
game feel less stingy without making it easier for everyone.

## Context

From the 2026-10-12 balance pass (see `ideas/zombie-horde.md`): the push-back
(space bar or ✋) sends the closest zombie all the way to the back of the
field, whatever answer it carries. Because each one cancels a whole crossing,
the balance simulation (`frontend/src/horde/horde_balance.pure.lib.test.ts`)
showed that two free push-backs per round make the round unlosable even for a
player who barely answers, so the free allowance is one
(`SHOVES_PER_ROUND` in `horde_engine.pure.lib.ts`). The user may find one
stingy; buying more keeps the free game honest while letting a kid who earned
points spend them on breathing room.

What exists to build on:
- **Consumables already work this way.** Grenade packs and special-round
  packs are `consumable` armory items: bought again and again, counted in
  the ledger (`purchased` entries add, `grenades_used` / `rounds_used`
  entries spend), clamped server-side to what the profile has
  (`backend/app/armory/armory_reducers_pure.py`: `summarize`,
  `clamped_round`).
- **The engine already counts push-backs** (`HordeState.shoves`,
  `stats.shoves`); `createRound` takes the starting count.
- **The shop already shows consumables** with a count and a Buy button
  (`frontend/src/horde/armory_shop.pure.ui.tsx`).

## Scope

In scope:
- A `push_back_pack` armory item: kind `push_back` (or reuse a generic
  consumable kind), e.g. 3 push-backs for ~60 points (tune).
- `ArmoryState.push_backs` (owned, beyond the free one) and
  `ArmoryRoundCreate.push_backs_used`, ledger entries, clamping, tests,
  regenerated API types.
- A round starts with `SHOVES_PER_ROUND + owned` push-backs; the round
  reports how many *bought* ones it used (free one first).
- Shop card and HUD count.

Out of scope:
- More than one free push-back per round (the simulation says no).
- Any change to what a push-back does.

## Starter instructions for Claude

1. Read `ideas/zombie-horde.md` (the balance section), then
   `horde_balance.pure.lib.test.ts`, then the grenade-pack path end to end:
   `armory_reducers_pure.py` (`CATALOG`, `summarize`, `clamped_round`,
   `round_entries`), `use_horde_round.pure.hook.ts` (`start`, `finish`),
   and `armory_shop.pure.ui.tsx`. Copy that path.
2. Extend the balance test with a case for bought push-backs, and ask the
   user what a pack should cost given what the simulation shows (each
   push-back is worth about a whole zombie crossing; with several, a slow
   player survives). Don't guess the price.
3. Use the free push-back before bought ones, so a kid never spends a
   bought one when the free one is still there.
4. Raise with the user: should there be a cap on how many can be used in
   one round (e.g. 3), so a big stockpile can't make any single round
   unlosable?
