import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { HordeHud, type HordeHudProps } from './horde_hud.pure.ui.tsx'

afterEach(cleanup)

function props(overrides: Partial<HordeHudProps> = {}): HordeHudProps {
  return {
    question: '3 + 4 =',
    intro: false,
    secondsLeft: 42,
    lives: 2,
    grenades: 1,
    shoves: 3,
    ammo: null,
    armed: 'shot',
    muted: false,
    answers: [
      { zombieId: 'z1', label: '7' },
      { zombieId: 'z2', label: '8' },
    ],
    feedback: null,
    aimNdc: null,
    reducedMotion: false,
    onBack: vi.fn(),
    onToggleGrenade: vi.fn(),
    onPushBack: vi.fn(),
    onToggleMute: vi.fn(),
    onZap: vi.fn(),
    flags: 0,
    onFlag: vi.fn(),
    ...overrides,
  }
}

describe('HordeHud', () => {
  it('shows the question, clock, and lives', () => {
    render(<HordeHud {...props()} />)
    expect(screen.getByRole('heading', { name: 'Question' }).textContent).toBe('3 + 4 =')
    expect(screen.getByRole('timer', { name: '42 seconds left' })).toBeTruthy()
    expect(screen.getByRole('img', { name: '2 lives left' })).toBeTruthy()
  })

  it('zaps a zombie from its answer button', () => {
    const onZap = vi.fn()
    render(<HordeHud {...props({ onZap })} />)
    fireEvent.click(screen.getByRole('button', { name: 'Zap the zombie carrying 8' }))
    expect(onZap).toHaveBeenCalledWith('z2')
  })

  it('arms a grenade, and says so', () => {
    const onToggleGrenade = vi.fn()
    const { rerender } = render(<HordeHud {...props({ onToggleGrenade })} />)
    fireEvent.click(screen.getByRole('button', { name: 'Grenade (1 left)' }))
    expect(onToggleGrenade).toHaveBeenCalledTimes(1)
    rerender(<HordeHud {...props({ armed: 'grenade' })} />)
    expect(screen.getByRole('button', { name: /armed/ }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('status').textContent).toContain('Grenade ready')
  })

  it('disables the grenade with none left', () => {
    render(<HordeHud {...props({ grenades: 0 })} />)
    expect(screen.getByRole('button', { name: 'Grenade (0 left)' }).hasAttribute('disabled')).toBe(true)
  })

  it('back and mute', () => {
    const onBack = vi.fn()
    const onToggleMute = vi.fn()
    render(<HordeHud {...props({ onBack, onToggleMute, muted: true })} />)
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    fireEvent.click(screen.getByRole('button', { name: 'Unmute' }))
    expect(onBack).toHaveBeenCalledTimes(1)
    expect(onToggleMute).toHaveBeenCalledTimes(1)
  })

  it('flashes each kind of feedback', () => {
    const { container } = render(<HordeHud {...props({ feedback: { kind: 'hurt', id: 1 } })} />)
    expect(container.querySelector('[data-feedback-kind="hurt"]')).toBeTruthy()
  })

  it('pushes back the closest zombie in one press, and disables it with none left', () => {
    const onPushBack = vi.fn()
    render(<HordeHud {...props({ onPushBack, shoves: 1 })} />)
    fireEvent.click(screen.getByRole('button', { name: 'Push back the closest zombie (1 left)' }))
    expect(onPushBack).toHaveBeenCalledTimes(1)
    cleanup()
    render(<HordeHud {...props({ shoves: 0 })} />)
    expect(screen.getByRole('button', { name: 'Push back the closest zombie (0 left)' }).hasAttribute('disabled')).toBe(true)
  })

  it('flags a moment for the recording', () => {
    const onFlag = vi.fn()
    render(<HordeHud {...props({ onFlag, flags: 2 })} />)
    fireEvent.click(screen.getByRole('button', { name: 'Flag this moment (2 flagged)' }))
    expect(onFlag).toHaveBeenCalledTimes(1)
  })
})
