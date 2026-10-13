import { describe, expect, it } from 'vitest'
import { GRENADE, STARTER_LOADOUT, shotPower } from './horde_armory.pure.lib.ts'
import { ROUND_MS, SHOVES_PER_ROUND, STARTING_LIVES, answerFor, createRound, inOvertime, setQuestion, shoot, shove, tick, type HordeConfig, type HordeQuestion, type HordeState } from './horde_engine.pure.lib.ts'
import { EASY, HARD } from './horde_difficulty.pure.lib.ts'
import { COVER } from './horde_field.pure.lib.ts'
import { hordeItem } from './horde_fakes.test.ui.tsx'
import { travelMsFor } from './horde_question.pure.lib.ts'

/**
 * Is a round winnable, and not too winnable? A simulated player with perfect
 * aim answers every `answerMs`, headshots the right zombie, and uses its
 * push-backs (the one it starts with and the ones it earns before overtime) on a wrong zombie
 * about to reach it. Over 40 seeds, at the
 * fastest walk (the top level) and the slowest (level 1), on medium, with
 * checks that hard and easy stay fair (horde_difficulty). Beating the clock
 * wins; overtime then has to end, even for a perfect player.
 */

function question(n: number): HordeQuestion {
  return { id: `q${String(n)}`, text: '', summary: '', options: ['a', 'b', 'c', 'd'].map((label, i) => ({ label, correct: i === 0 })) }
}

/** How long a round lasts (ms), playing on into overtime when `overtime`; capped at 20 minutes. */
function lasts(travelMs: number, answerMs: number, seed: number, overtime: boolean): number {
  const config: HordeConfig = { durationMs: ROUND_MS, travelMs, power: shotPower(STARTER_LOADOUT), basePower: shotPower(STARTER_LOADOUT), cooldownMs: 700, grenade: GRENADE, cover: COVER, thornsDamage: 0 }
  let state: HordeState = setQuestion(createRound({ seed, lives: STARTING_LIVES, grenades: 0, shoves: SHOVES_PER_ROUND, ammo: 0, cover: COVER }), question(0))
  let asked = 0
  let askedAt = 0
  let nextAt = -1
  while (state.outcome === 'playing' && (overtime || !inOvertime(state)) && state.elapsedMs < 20 * 60_000) {
    state = tick(state, 16, config)
    if (state.question === null) {
      if (nextAt < 0) nextAt = state.elapsedMs + 600
      if (state.elapsedMs >= nextAt) {
        state = setQuestion(state, question(++asked))
        askedAt = state.elapsedMs
        nextAt = -1
      }
      continue
    }
    const current = state
    const closeAndWrong = current.zombies.find((z) => z.posture === 'advancing' && z.depth < 3 && answerFor(current, z)?.correct === false)
    if (closeAndWrong !== undefined && current.shoves > 0) state = shove(current, closeAndWrong.id, config)
    if (state.elapsedMs - askedAt >= answerMs) {
      const right = state.zombies.find((z) => answerFor(state, z)?.correct === true)
      if (right !== undefined) state = shoot(state, { zombieId: right.id, zone: 'head' }, config)
    }
  }
  return state.elapsedMs
}

function winRate(travelMs: number, answerMs: number): number {
  let wins = 0
  for (let seed = 0; seed < 40; seed++) if (lasts(travelMs, answerMs, seed, false) >= ROUND_MS) wins++
  return wins / 40
}

/** The longest any of 40 seeds lasts. */
function longest(travelMs: number, answerMs: number): number {
  let most = 0
  for (let seed = 0; seed < 40; seed++) most = Math.max(most, lasts(travelMs, answerMs, seed, true))
  return most
}

/** The median over 40 seeds. */
function typical(travelMs: number, answerMs: number): number {
  const all = Array.from({ length: 40 }, (_, seed) => lasts(travelMs, answerMs, seed, true)).sort((a, b) => a - b)
  return all[20] ?? 0
}

const TOP = travelMsFor({ ...hordeItem(0, 4500), level: 10 })
const FIRST = travelMsFor({ ...hordeItem(0, 9000), level: 1 })

describe('Zombie Horde balance', () => {
  it('walks slower at level 1 than at the top, but never much faster', () => {
    expect(FIRST).toBe(54_000)
    expect(TOP).toBe(45_000)
  })

  it('a steady player (an answer every 6s) almost always survives, even at the top level', { timeout: 30_000 }, () => {
    expect(winRate(TOP, 6000)).toBeGreaterThanOrEqual(0.9)
    expect(winRate(FIRST, 6000)).toBeGreaterThanOrEqual(0.95)
  })

  it('a slow but correct player (every 10s) still has a fair chance', { timeout: 30_000 }, () => {
    expect(winRate(TOP, 10_000)).toBeGreaterThanOrEqual(0.5)
  })

  it('barely answering (every 20s) loses: the math is what holds the horde back', { timeout: 30_000 }, () => {
    expect(winRate(TOP, 20_000)).toBeLessThanOrEqual(0.25)
  })

  it('hard is harder but still fair: a steady player almost always survives the top level, a slow one less often than on medium', { timeout: 30_000 }, () => {
    const hard = TOP * HARD.travelScale
    expect(winRate(hard, 6000)).toBeGreaterThanOrEqual(0.9)
    expect(winRate(hard, 10_000)).toBeLessThanOrEqual(0.8)
    expect(winRate(hard, 10_000)).toBeGreaterThanOrEqual(0.4)
  })

  it('easy is gentler, but barely answering still loses', { timeout: 30_000 }, () => {
    expect(winRate(TOP * EASY.travelScale, 10_000)).toBeGreaterThanOrEqual(0.95)
    expect(winRate(TOP * EASY.travelScale, 20_000)).toBeLessThanOrEqual(0.35)
  })

  it('overtime always ends: even a perfect, quick player (an answer every 2s) is overrun within 4 minutes', { timeout: 60_000 }, () => {
    expect(longest(FIRST, 2000)).toBeLessThan(4 * 60_000)
  })

  it('in overtime, quicker math sets a longer record', { timeout: 60_000 }, () => {
    const quick = typical(FIRST, 2000)
    const steady = typical(FIRST, 6000)
    expect(steady).toBeGreaterThan(ROUND_MS + 15_000)
    expect(quick).toBeGreaterThan(steady + 30_000)
  })
})
