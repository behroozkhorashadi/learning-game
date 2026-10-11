import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { assembleZombieHitLab } from './zombie_hit_lab.assembly.main.ts'

/** jsdom has no ResizeObserver; with it stubbed, R3F's <Canvas> mounts (at zero size, so it never needs WebGL). */
function stubResizeObserver(): void {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    },
  )
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  localStorage.clear()
})

describe('assembleZombieHitLab', () => {
  it('opens on the setup in the URL, with the saved shots', () => {
    stubResizeObserver()
    localStorage.setItem('zombieHitLab.shots.v1', JSON.stringify([{ id: 'a', characterId: 'scientist', lane: 1, distance: 0.5, poseTime: 0.5, ndc: { x: 0, y: 0 }, expected: 'head', recorded: 'head' }]))
    const ZombieHitLab = assembleZombieHitLab()
    render(<ZombieHitLab />)
    expect(screen.getByRole('status').textContent).toContain('Labeled 1')
  })
})
