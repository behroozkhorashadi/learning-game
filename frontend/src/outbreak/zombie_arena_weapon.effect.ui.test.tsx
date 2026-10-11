import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { arenaHarness, rightAnswer, wrongAnswers, type ArenaHarness, type ArenaHarnessOptions } from './arena_fakes.test.ui.tsx'

/**
 * The two-shot blaster as the player sees it: the charge HUD, cocking between
 * shots (a click mid-cocking is ignored end to end), the mute control, and
 * the dev tuning panel's production guard.
 */

afterEach(cleanup)

async function startArena(options: ArenaHarnessOptions = {}): Promise<ArenaHarness> {
  const harness = arenaHarness(options)
  render(<harness.ZombieArena profileId={1} onBack={() => undefined} />)
  fireEvent.click(screen.getByRole('button', { name: 'Start' }))
  await act(async () => undefined)
  await harness.scheduler.advance(1200)
  return harness
}

function shoot(value: number): void {
  fireEvent.click(screen.getByRole('button', { name: `headshot ${String(value)}` }))
}

describe('ZombieArena: charge HUD', () => {
  it('starts each wave with two charges', async () => {
    await startArena()
    expect(screen.getByRole('status', { name: '2 shots left' })).toBeTruthy()
  })

  it('drops to one charge and cocks after a wrong first shot, then resets on the next question', async () => {
    const harness = await startArena()
    const [wrong] = wrongAnswers(0)
    if (wrong === undefined) throw new Error('need a wrong answer')
    shoot(wrong)
    expect(screen.getByRole('status', { name: 'Cocking the blaster' })).toBeTruthy()
    await harness.scheduler.advance(1000)
    expect(screen.getByRole('status', { name: '1 shot left' })).toBeTruthy()
    shoot(rightAnswer(0))
    await harness.scheduler.advance(700 + 1200 + 100)
    expect(screen.getByRole('status', { name: '2 shots left' })).toBeTruthy()
  })

  it('never cocks after a correct first shot', async () => {
    const harness = await startArena()
    shoot(rightAnswer(0))
    await harness.scheduler.advance(500)
    expect(screen.queryByRole('status', { name: 'Cocking the blaster' })).toBeNull()
  })

  it('ignores a shot fired while cocking: no defeat, no hidden shot spent, no sound', async () => {
    const harness = await startArena()
    const [first, second] = wrongAnswers(0)
    if (first === undefined || second === undefined) throw new Error('need two wrong answers')
    shoot(first)
    shoot(second)
    expect(screen.getByRole('button', { name: `headshot ${String(second)}` })).toBeTruthy()
    expect(harness.audio.count('playShot')).toBe(1)
    await harness.scheduler.advance(1000)
    expect(screen.getByRole('status', { name: '1 shot left' })).toBeTruthy()
  })
})

describe('ZombieArena: mute', () => {
  it('toggles the audio and the button label', async () => {
    const harness = await startArena()
    fireEvent.click(screen.getByRole('button', { name: 'Mute' }))
    expect(harness.audio.isMuted()).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Unmute' }))
    expect(harness.audio.isMuted()).toBe(false)
  })
})

describe('ZombieArena: dev weapon tuning', () => {
  it('shows the tuning panel only when assembly enabled it', async () => {
    await startArena()
    expect(screen.queryByRole('region', { name: 'Weapon tuning' })).toBeNull()
    cleanup()
    await startArena({ debug: { lanes: false, weaponTuning: true } })
    expect(screen.getByRole('region', { name: 'Weapon tuning' })).toBeTruthy()
  })
})
