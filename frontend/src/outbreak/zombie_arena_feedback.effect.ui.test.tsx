import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { arenaHarness, rightAnswer, wrongAnswers, type ArenaHarness } from './arena_fakes.test.ui.tsx'

/**
 * The correct/wrong/attacked feedback: what renders for each kind of shot, not
 * the wave rules underneath (zombie_arena.effect.ui.test.tsx). The vignette is
 * decorative (aria-hidden), so these read its data attributes.
 */

afterEach(cleanup)

async function startArena(): Promise<ArenaHarness> {
  const harness = arenaHarness()
  render(<harness.ZombieArena profileId={1} onBack={() => undefined} />)
  fireEvent.click(screen.getByRole('button', { name: 'Start' }))
  await act(async () => undefined)
  await harness.scheduler.advance(1200)
  return harness
}

function shoot(kind: 'headshot' | 'bodyshot', value: number): void {
  fireEvent.click(screen.getByRole('button', { name: `${kind} ${String(value)}` }))
}

function vignettes(): readonly HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>('[data-feedback-kind]'))
}

function arenaAnimation(): string {
  return screen.getByRole('application', { name: 'Zombie arena' }).style.animation
}

function firstWrong(): number {
  const wrong = wrongAnswers(0)[0]
  if (wrong === undefined) throw new Error('need a wrong answer')
  return wrong
}

describe('ZombieArena: answer feedback', () => {
  it('a correct hit shows exactly one green vignette, gone after its pulse', async () => {
    const harness = await startArena()
    shoot('headshot', rightAnswer(0))
    expect(vignettes().map((v) => v.dataset['feedbackKind'])).toEqual(['correctHit'])
    await harness.scheduler.advance(450)
    expect(vignettes()).toHaveLength(0)
  })

  it('a body shot gives the same correct-hit feedback as a headshot', async () => {
    await startArena()
    shoot('bodyshot', rightAnswer(0))
    expect(vignettes().map((v) => v.dataset['feedbackKind'])).toEqual(['correctHit'])
  })

  it('a wrong hit that leaves the wave going shows one red vignette and a small shake', async () => {
    await startArena()
    shoot('headshot', firstWrong())
    expect(vignettes().map((v) => v.dataset['feedbackKind'])).toEqual(['wrongHit'])
    expect(arenaAnimation()).toContain('wrongHitShake')
  })

  it('a background miss shows no vignette', async () => {
    const harness = await startArena()
    fireEvent.click(screen.getByRole('button', { name: 'background miss' }))
    await harness.scheduler.advance(100)
    expect(vignettes()).toHaveLength(0)
  })

  it('the second wrong defeat gets only the stronger life-lost overlay, not its own small vignette', async () => {
    const harness = await startArena()
    const [first, second] = wrongAnswers(0)
    if (first === undefined || second === undefined) throw new Error('need two wrong answers')
    shoot('headshot', first)
    await harness.scheduler.advance(1000)
    shoot('headshot', second)
    await harness.scheduler.advance(900)
    expect(screen.getByText(/Lives left: 2/)).toBeTruthy()
    expect(vignettes()).toHaveLength(0)
  })

  it('a zombie reaching the player shakes the screen hard, without a small vignette', async () => {
    const harness = await startArena()
    await harness.scheduler.advance(8000)
    expect(screen.getByText('A zombie got through!')).toBeTruthy()
    // The shake starts with `impact`, after the contact hold, and lasts until the frozen panel.
    await harness.scheduler.advance(750)
    expect(arenaAnimation()).toContain('screenShake')
    expect(vignettes()).toHaveLength(0)
  })

  it('an unrelated re-render (aiming) neither replays nor duplicates the feedback', async () => {
    await startArena()
    shoot('headshot', rightAnswer(0))
    const id = vignettes()[0]?.dataset['feedbackId']
    const arena = screen.getByRole('application', { name: 'Zombie arena' })
    fireEvent.pointerMove(arena, { clientX: 10, clientY: 10 })
    fireEvent.pointerMove(arena, { clientX: 20, clientY: 30 })
    expect(vignettes().map((v) => v.dataset['feedbackId'])).toEqual([id])
  })
})

describe('ZombieArena: zombie-hit sound', () => {
  it('plays for a body shot, right or wrong, a beat after the shot sound', async () => {
    const harness = await startArena()
    shoot('bodyshot', firstWrong())
    expect(harness.audio.count('playShot')).toBe(1)
    expect(harness.audio.count('playZombieHit')).toBe(0)
    await harness.scheduler.advance(100)
    expect(harness.audio.count('playZombieHit')).toBe(1)
    await harness.scheduler.advance(1000)
    shoot('bodyshot', rightAnswer(0))
    await harness.scheduler.advance(100)
    expect(harness.audio.count('playZombieHit')).toBe(2)
  })

  it('never plays for a headshot, right or wrong', async () => {
    const harness = await startArena()
    shoot('headshot', firstWrong())
    await harness.scheduler.advance(1000)
    shoot('headshot', rightAnswer(0))
    await harness.scheduler.advance(200)
    expect(harness.audio.count('playZombieHit')).toBe(0)
  })

  it('plays the attack sound with the swipe when a zombie gets through', async () => {
    const harness = await startArena()
    await harness.scheduler.advance(8000)
    expect(harness.audio.count('playZombieAttack')).toBe(0)
    await harness.scheduler.advance(500)
    expect(harness.audio.count('playZombieAttack')).toBe(1)
  })
})
