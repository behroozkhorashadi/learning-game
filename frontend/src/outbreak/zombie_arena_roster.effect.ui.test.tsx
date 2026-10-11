import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ZOMBIE_CHARACTER_REGISTRY } from '@app/zombies/character_definitions.pure.lib.ts'
import { arenaHarness, rightAnswer, wrongAnswers, type ArenaHarness } from './arena_fakes.test.ui.tsx'

/**
 * The character roster: picked once per session, one of each per wave, and
 * reshuffled across lanes each wave. The fake viewport lists which character
 * got which lane.
 */

afterEach(cleanup)

const ENABLED_IDS = ZOMBIE_CHARACTER_REGISTRY.filter((c) => c.enabled).map((c) => c.id)

async function startArena(): Promise<ArenaHarness> {
  const harness = arenaHarness()
  render(<harness.ZombieArena profileId={1} onBack={() => undefined} />)
  fireEvent.click(screen.getByRole('button', { name: 'Start' }))
  await act(async () => undefined)
  await harness.scheduler.advance(1200)
  return harness
}

function laneCharacters(): readonly string[] {
  return within(screen.getByRole('list', { name: 'Lane characters' }))
    .getAllByRole('listitem')
    .map((li) => li.textContent)
}

async function solveWave(harness: ArenaHarness, i: number): Promise<void> {
  fireEvent.click(screen.getByRole('button', { name: `headshot ${String(rightAnswer(i))}` }))
  await harness.scheduler.advance(700 + 1200 + 100)
}

describe('ZombieArena: character roster', () => {
  it('a new session picks four unique, enabled characters, one per lane', async () => {
    const harness = await startArena()
    const ids = laneCharacters()
    expect(ids).toHaveLength(4)
    expect(new Set(ids).size).toBe(4)
    for (const id of ids) expect(ENABLED_IDS).toContain(id)
    expect(harness.rosterPicks()).toBe(1)
  })

  it('the next question keeps the session roster but reshuffles the lanes', async () => {
    const harness = await startArena()
    const first = laneCharacters()
    await solveWave(harness, 0)
    const second = laneCharacters()
    expect([...second].sort()).toEqual([...first].sort())
    expect(second).not.toEqual(first)
    expect(harness.rosterPicks()).toBe(1)
  })

  it('Try again after a game over picks a fresh roster', async () => {
    const harness = await startArena()
    for (let life = 0; life < 3; life++) {
      const [a, b] = wrongAnswers(life)
      if (a === undefined || b === undefined) throw new Error('need two wrong answers')
      fireEvent.click(screen.getByRole('button', { name: `headshot ${String(a)}` }))
      await harness.scheduler.advance(1000)
      fireEvent.click(screen.getByRole('button', { name: `headshot ${String(b)}` }))
      await harness.scheduler.advance(900)
      if (life < 2) {
        fireEvent.click(screen.getByRole('button', { name: 'Next Question' }))
        await act(async () => undefined)
        await harness.scheduler.advance(1200)
      }
    }
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await act(async () => undefined)
    await harness.scheduler.advance(1200)
    expect(new Set(laneCharacters()).size).toBe(4)
    expect(harness.rosterPicks()).toBe(2)
  })

  it('every character on a wave groans as it spawns', async () => {
    const harness = await startArena()
    expect(harness.audio.count('playGroan')).toBe(4)
    expect(harness.audio.count('preloadZombies')).toBe(1)
  })
})
