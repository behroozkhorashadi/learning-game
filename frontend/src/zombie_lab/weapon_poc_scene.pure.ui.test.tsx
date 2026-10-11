import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { WeaponPOCScene } from './weapon_poc_scene.pure.ui.tsx'

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

describe('WeaponPOCScene', () => {
  it('switches between the blaster and each arm', () => {
    stubResizeObserver()
    render(<WeaponPOCScene />)
    expect(screen.getByRole('button', { name: 'Equation Blaster' }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: 'Left arm' }))
    expect(screen.getByRole('button', { name: 'Left arm' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByText(/Red = \+X/)).toBeTruthy()
  })
})
