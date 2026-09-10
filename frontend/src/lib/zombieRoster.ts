import type { CharacterDefinition } from './characterDefinitions'

/**
 * Pure session-roster selection — no React, no rendering, no Three.js.
 * `ZombieMathBlaster` calls `selectSessionRoster` exactly once per game
 * session (initial Start, and again on Try Again / a brand-new session),
 * never per render and never per wave, then reuses the returned roster for
 * every wave in that session (shuffling only *which lane* each roster
 * member sits in — see `shuffle`, reused for that too).
 *
 * Written against today's four enabled characters, but nothing here
 * assumes exactly four are registered: growing the registry to 20+ enabled
 * characters changes nothing about this function or its callers — a
 * session still gets `rosterSize` unique ones, chosen from whatever's
 * `enabled` at the time.
 */

/** Returns a float in [0, 1) — the same contract as `Math.random`. Tests
 * inject a stub/seeded function instead of the real thing for determinism. */
export type RandomFn = () => number

/** Fisher-Yates shuffle of a copy of `items` — never mutates its input. */
export function shuffle<T>(items: readonly T[], random: RandomFn = Math.random): T[] {
  const copy = items.slice()
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

/**
 * Selects `rosterSize` unique, currently-`enabled` characters from
 * `registry`, without mutating it. Throws if fewer than `rosterSize`
 * characters are enabled — a misconfiguration a session should surface
 * loudly rather than silently render fewer zombies than the wave engine
 * expects (the engine always spawns exactly four carriers per wave).
 */
export function selectSessionRoster(registry: readonly CharacterDefinition[], rosterSize: number, random: RandomFn = Math.random): CharacterDefinition[] {
  const enabled = registry.filter((character) => character.enabled)
  if (enabled.length < rosterSize) {
    throw new Error(`selectSessionRoster: need at least ${rosterSize} enabled characters, found ${enabled.length}`)
  }
  return shuffle(enabled, random).slice(0, rosterSize)
}
