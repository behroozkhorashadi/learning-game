import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { ChargeHud } from './ChargeHud'

afterEach(() => cleanup())

describe('ChargeHud', () => {
  it('shows two filled charge orbs at wave start (2 shots remaining)', () => {
    render(<ChargeHud shotsRemaining={2} weaponPhase="readyFirstShot" reducedMotion={false} />)
    const hud = screen.getByTestId('charge-hud')
    expect(hud.getAttribute('data-charge-state')).toBe('shots')
    expect(hud.getAttribute('data-shots-remaining')).toBe('2')
  })

  it('shows one filled, one empty after the first shot is consumed', () => {
    render(<ChargeHud shotsRemaining={1} weaponPhase="readySecondShot" reducedMotion={false} />)
    const hud = screen.getByTestId('charge-hud')
    expect(hud.getAttribute('data-shots-remaining')).toBe('1')
  })

  it('shows a "Cocking…" indicator instead of orbs while the weapon is cocking', () => {
    render(<ChargeHud shotsRemaining={1} weaponPhase="cocking" reducedMotion={false} />)
    expect(screen.getByTestId('charge-hud').getAttribute('data-charge-state')).toBe('cocking')
    expect(screen.getByText(/cocking/i)).toBeTruthy()
  })

  it('shows both orbs empty once the final shot is spent and the wave is resolved', () => {
    render(<ChargeHud shotsRemaining={0} weaponPhase="waveResolved" reducedMotion={false} />)
    const hud = screen.getByTestId('charge-hud')
    expect(hud.getAttribute('data-charge-state')).toBe('shots')
    expect(hud.getAttribute('data-shots-remaining')).toBe('0')
  })

  it('does not apply the pulsing animation when reduced motion is requested', () => {
    render(<ChargeHud shotsRemaining={1} weaponPhase="cocking" reducedMotion />)
    const hud = screen.getByTestId('charge-hud')
    expect(hud.style.animation).toBe('none')
  })
})
