import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ChargeHud } from './charge_hud.pure.ui.tsx'

afterEach(cleanup)

describe('ChargeHud', () => {
  it('shows two charges at wave start', () => {
    render(<ChargeHud shotsRemaining={2} weaponPhase="readyFirstShot" reducedMotion={false} />)
    expect(screen.getByRole('status', { name: '2 shots left' })).toBeTruthy()
  })

  it('shows one charge after the first shot', () => {
    render(<ChargeHud shotsRemaining={1} weaponPhase="readySecondShot" reducedMotion={false} />)
    expect(screen.getByRole('status', { name: '1 shot left' })).toBeTruthy()
  })

  it('says it is cocking instead of showing orbs, pulsing unless motion is reduced', () => {
    render(<ChargeHud shotsRemaining={1} weaponPhase="cocking" reducedMotion={false} />)
    const status = screen.getByRole('status', { name: 'Cocking the blaster' })
    expect(status.textContent).toBe('Cocking…')
    expect(status.style.animation).toContain('chargeCockingPulse')
    cleanup()
    render(<ChargeHud shotsRemaining={1} weaponPhase="cocking" reducedMotion />)
    expect(screen.getByRole('status', { name: 'Cocking the blaster' }).style.animation).toBe('none')
  })

  it('shows no charges once both shots are spent', () => {
    render(<ChargeHud shotsRemaining={0} weaponPhase="waveResolved" reducedMotion={false} />)
    expect(screen.getByRole('status', { name: '0 shots left' })).toBeTruthy()
  })
})
