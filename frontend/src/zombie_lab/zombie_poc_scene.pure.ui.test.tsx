import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ZOMBIE_CHARACTER_REGISTRY } from '@app/zombies/character_definitions.pure.lib.ts'
import { ZombiePOCScene } from './zombie_poc_scene.pure.ui.tsx'

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
})

describe('ZombiePOCScene', () => {
  it('offers every registered character and clip role, one of each pressed', () => {
    stubResizeObserver()
    render(<ZombiePOCScene />)
    for (const c of ZOMBIE_CHARACTER_REGISTRY) expect(screen.getByRole('button', { name: new RegExp(c.displayName) })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'reach' }))
    expect(screen.getByRole('button', { name: 'reach' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: 'idle' }).getAttribute('aria-pressed')).toBe('false')
  })
})
