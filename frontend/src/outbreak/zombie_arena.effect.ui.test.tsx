import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { arenaHarness, rightAnswer, wrongAnswers, type ArenaHarness, type ArenaHarnessOptions } from './arena_fakes.test.ui.tsx'

/**
 * The arena's orchestration: phases, the API side effects, point-and-click
 * shooting, and the life-loss, victory, and game-over flows, over a plain-DOM
 * viewport and a virtual clock (no WebGL, no real waiting). The wave rules
 * themselves (damage, telemetry, resolution) are zombie_wave_engine's tests;
 * these confirm the arena wires them up.
 */

afterEach(cleanup)

const SESSION_LENGTH = 10
/** Past the intro beat (1.1s), so the wave has spawned. */
const INTRO = 1200
/** Past the blaster's 900ms cocking, so the second shot is accepted. */
const COCKING = 1000

async function startArena(options: ArenaHarnessOptions = {}): Promise<ArenaHarness> {
  const harness = arenaHarness(options)
  render(<harness.ZombieArena profileId={1} onBack={() => undefined} />)
  fireEvent.click(screen.getByRole('button', { name: 'Start' }))
  await act(async () => undefined)
  await harness.scheduler.advance(INTRO)
  return harness
}

function shoot(kind: 'headshot' | 'bodyshot', value: number): void {
  fireEvent.click(screen.getByRole('button', { name: `${kind} ${String(value)}` }))
}

/** Solved wave → short celebratory beat → the next question → its intro. */
async function nextWave(harness: ArenaHarness): Promise<void> {
  await harness.scheduler.advance(700 + INTRO + 100)
}

/** Two wrong defeats in round `i`: the second ends the wave as a life lost, frozen after the impact beat. */
async function loseLife(harness: ArenaHarness, i: number): Promise<void> {
  const [first, second] = wrongAnswers(i)
  if (first === undefined || second === undefined) throw new Error('need two wrong answers')
  shoot('headshot', first)
  await harness.scheduler.advance(COCKING)
  shoot('headshot', second)
  await harness.scheduler.advance(900)
}

describe('ZombieArena (Equation Outbreak): session flow', () => {
  it('wins via ten correct headshots and shows the victory copy and stats', async () => {
    const harness = await startArena()
    for (let i = 0; i < SESSION_LENGTH; i++) {
      shoot('headshot', rightAnswer(i))
      await nextWave(harness)
    }
    expect(screen.getByText('You stopped the Equation Outbreak!')).toBeTruthy()
    expect(screen.getByText('Average response')).toBeTruthy()
    expect(screen.getByText('10 / 10')).toBeTruthy()
    expect(screen.getAllByText('Correct')).toHaveLength(SESSION_LENGTH)
    expect(harness.attempts).toHaveLength(SESSION_LENGTH)
    expect(harness.attempts.every((a) => a.telemetry.correct === true)).toBe(true)
    expect(harness.attempts[0]).toMatchObject({ item_id: 'item-0', profile_id: 1, game_id: 'fact_fluency', session_id: 'session-1', telemetry: { hints_used: 0 } })
  })

  it('announces the answer and shows the question big during the intro, then at the top', async () => {
    const harness = arenaHarness()
    render(<harness.ZombieArena profileId={1} onBack={() => undefined} />)
    fireEvent.click(screen.getByRole('button', { name: 'Start' }))
    await act(async () => undefined)
    expect(screen.getByRole('heading', { name: 'Question' }).textContent).toBe('3 + 4 =')
    expect(screen.queryByRole('button', { name: 'headshot 7' })).toBeNull()
    await harness.scheduler.advance(INTRO)
    shoot('headshot', 7)
    expect(screen.getByText('Correct! 3 + 4 = 7')).toBeTruthy()
  })

  it('a correct body shot solves the wave immediately', async () => {
    const harness = await startArena()
    shoot('bodyshot', rightAnswer(0))
    await nextWave(harness)
    expect(screen.getByRole('button', { name: `headshot ${String(rightAnswer(1))}` })).toBeTruthy()
    expect(harness.attempts.map((a) => a.telemetry.correct)).toEqual([true])
  })

  it('defeating one wrong zombie speeds the wave up but keeps it going', async () => {
    const harness = await startArena()
    const [wrong] = wrongAnswers(0)
    if (wrong === undefined) throw new Error('need a wrong answer')
    shoot('headshot', wrong)
    await harness.scheduler.advance(COCKING)
    shoot('headshot', rightAnswer(0))
    await nextWave(harness)
    expect(screen.getByRole('button', { name: `headshot ${String(rightAnswer(1))}` })).toBeTruthy()
    expect(harness.attempts.map((a) => a.telemetry.hints_used)).toEqual([1])
  })

  it('a second wrong defeat ends the round frozen until Next Question', async () => {
    const harness = await startArena()
    await loseLife(harness, 0)
    expect(screen.getByRole('dialog', { name: 'Round result' }).textContent).toContain('Too many wrong targets!')
    expect(screen.getByText(/Lives left: 2/)).toBeTruthy()
    expect(document.activeElement).toBe(screen.getByRole('dialog', { name: 'Round result' }))

    // It must not auto-advance.
    await harness.scheduler.advance(3000)
    expect(screen.queryByRole('button', { name: `headshot ${String(rightAnswer(1))}` })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Next Question' }))
    await act(async () => undefined)
    await harness.scheduler.advance(INTRO)
    expect(screen.getByRole('button', { name: `headshot ${String(rightAnswer(1))}` })).toBeTruthy()
  })

  it('a zombie reaching the player costs a life', async () => {
    const harness = await startArena()
    await harness.scheduler.advance(8000)
    expect(screen.getByText('A zombie got through!')).toBeTruthy()
    await harness.scheduler.advance(700 + 900)
    expect(screen.getByRole('dialog', { name: 'Round result' }).textContent).toContain('A zombie got through!')
    expect(harness.attempts.map((a) => a.telemetry.correct)).toEqual([false])
  })

  it('losing all three lives ends the session at game over, not the next question', async () => {
    const harness = await startArena()
    for (let life = 0; life < 3; life++) {
      await loseLife(harness, life)
      if (life < 2) {
        fireEvent.click(screen.getByRole('button', { name: 'Next Question' }))
        await act(async () => undefined)
        await harness.scheduler.advance(INTRO)
      }
    }
    expect(screen.getByRole('heading', { name: 'The outbreak got the better of you this time!' })).toBeTruthy()
    expect(screen.getByText('Average response')).toBeTruthy()
    expect(screen.getByText('0 / 3')).toBeTruthy()
    expect(screen.getAllByText('Missed')).toHaveLength(3)
    expect(screen.queryByRole('button', { name: 'Next Question' })).toBeNull()
  })

  it('the on-screen answer button zaps that zombie', async () => {
    const harness = await startArena()
    fireEvent.click(screen.getByRole('button', { name: `Zap the zombie carrying ${String(rightAnswer(0))}` }))
    await nextWave(harness)
    expect(harness.attempts).toHaveLength(1)
    expect(screen.getByRole('button', { name: `headshot ${String(rightAnswer(1))}` })).toBeTruthy()
  })

  it('a background miss submits no attempt and leaves the score alone', async () => {
    const harness = await startArena()
    fireEvent.click(screen.getByRole('button', { name: 'background miss' }))
    await harness.scheduler.advance(COCKING)
    expect(harness.attempts).toHaveLength(0)
    expect(screen.getByRole('status', { name: 'Score' }).textContent).toBe('0 / 10')
  })

  it('rates the session at the end, and Try again starts a fresh session', async () => {
    const harness = await startArena()
    for (let i = 0; i < SESSION_LENGTH; i++) {
      shoot('headshot', rightAnswer(i))
      await nextWave(harness)
    }
    fireEvent.click(screen.getByRole('button', { name: '4 stars' }))
    expect(harness.ratings).toEqual([{ profile_id: 1, game_id: 'fact_fluency', scale: 'stars_1_5', value: 4 }])
    fireEvent.click(screen.getByRole('button', { name: 'Play again' }))
    await act(async () => undefined)
    await harness.scheduler.advance(INTRO)
    shoot('headshot', rightAnswer(10))
    expect(harness.attempts.at(-1)?.session_id).toBe('session-2')
  })

  it('shows why the next question could not load', async () => {
    await startArena({ nextItemFails: 'GET /api/items/next failed with HTTP 500' })
    expect(screen.getByRole('alert').textContent).toBe('Error: GET /api/items/next failed with HTTP 500')
  })
})

describe('ZombieArena: reduced motion', () => {
  it('drops the screen shake when the player prefers reduced motion', async () => {
    const harness = await startArena({ motion: { prefersReduced: () => true, subscribe: () => () => undefined } })
    await loseLife(harness, 0)
    expect(screen.getByRole('application', { name: 'Zombie arena' }).style.animation).toBe('none')
  })

  it('shakes on impact otherwise', async () => {
    const harness = await startArena()
    const [first, second] = wrongAnswers(0)
    if (first === undefined || second === undefined) throw new Error('need two wrong answers')
    shoot('headshot', first)
    await harness.scheduler.advance(COCKING)
    shoot('headshot', second)
    await act(async () => undefined)
    expect(screen.getByRole('application', { name: 'Zombie arena' }).style.animation).toContain('screenShake')
  })
})

describe('ZombieArena: cleanup', () => {
  it('stops the frame loop, its timers, and the music when it unmounts mid-round', async () => {
    const harness = arenaHarness()
    const { unmount } = render(<harness.ZombieArena profileId={1} onBack={() => undefined} />)
    fireEvent.click(screen.getByRole('button', { name: 'Start' }))
    await act(async () => undefined)
    expect(harness.scheduler.frameLoops()).toBe(1)
    unmount()
    expect(harness.scheduler.frameLoops()).toBe(0)
    expect(harness.audio.calls.at(-1)).toBe('stopMusic')
    // The intro timer was cancelled: advancing spawns nothing and doesn't throw.
    await harness.scheduler.advance(INTRO)
  })

  it('plays the music for the whole round and stops it at the end', async () => {
    const harness = await startArena()
    expect(harness.audio.count('startMusic')).toBeGreaterThan(0)
    for (let life = 0; life < 3; life++) {
      await loseLife(harness, life)
      if (life < 2) {
        fireEvent.click(screen.getByRole('button', { name: 'Next Question' }))
        await act(async () => undefined)
        await harness.scheduler.advance(INTRO)
      }
    }
    expect(harness.audio.calls.at(-1)).toBe('stopMusic')
  })
})
