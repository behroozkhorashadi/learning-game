import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { HordeHud, type HordeHudProps } from './horde_hud.pure.ui.tsx'

afterEach(cleanup)

function props(overrides: Partial<HordeHudProps> = {}): HordeHudProps {
  return {
    question: '3 + 4 =',
    revealedAnswer: null,
    onDontKnow: vi.fn(),
    intro: false,
    secondsLeft: 42,
    overtime: null,
    onEndOvertime: vi.fn(),
    lives: 2,
    armor: { reflect: 0, block: 0, mega: 0, heal: 0 },
    grenades: 1,
    shoves: 3,
    shoveEarned: false,
    ammo: null,
    outOfRounds: false,
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
    streak: 0,
    armorColor: '#5CA8E6',
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

  it('in overtime, counts up against the personal best and offers to stop and bank', () => {
    const onEndOvertime = vi.fn()
    render(<HordeHud {...props({ secondsLeft: 0, overtime: { lastedMs: 61_500, bestMs: 95_000, clockMs: 60_000 }, onEndOvertime })} />)
    expect(screen.getByRole('timer', { name: 'Overtime: 1 minute 1 second survived' }).textContent).toContain('1:01')
    expect(screen.getByRole('status', { name: 'Your best: 1 minute 35 seconds' })).toBeTruthy()
    expect(screen.getByText('🔥 Overtime! The zombies speed up. Beat 1:35')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Stop & bank points' }))
    expect(onEndOvertime).toHaveBeenCalledTimes(1)
  })

  it('says so once the record is broken, after the overtime banner has gone', () => {
    render(<HordeHud {...props({ secondsLeft: 0, overtime: { lastedMs: 96_000, bestMs: 95_000, clockMs: 60_000 } })} />)
    expect(screen.getByRole('status', { name: 'New personal best!' }).textContent).toContain('New record!')
    expect(screen.queryByText('Overtime!', { exact: false })).toBeNull()
  })

  it('with no record yet, just counts up', () => {
    render(<HordeHud {...props({ secondsLeft: 0, overtime: { lastedMs: 62_000, bestMs: 0, clockMs: 60_000 } })} />)
    expect(screen.getByText('🔥 Overtime! The zombies speed up')).toBeTruthy()
    expect(screen.queryByRole('status', { name: /best/i })).toBeNull()
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

  it('shows that G arms the grenade', () => {
    render(<HordeHud {...props()} />)
    const grenade = screen.getByRole('button', { name: 'Grenade (1 left)' })
    expect(grenade.getAttribute('aria-keyshortcuts')).toBe('G')
    expect(grenade.textContent).toContain('G')
  })

  it('says when the special rounds run out', () => {
    const { rerender } = render(<HordeHud {...props({ ammo: 1 })} />)
    expect(screen.queryByText(/Out of special rounds/)).toBeNull()
    rerender(<HordeHud {...props({ ammo: 0, outOfRounds: true })} />)
    expect(screen.getByText(/Out of special rounds/)).toBeTruthy()
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

  it('shows half a heart after a blocked hit', () => {
    render(<HordeHud {...props({ lives: 2.5 })} />)
    expect(screen.getByRole('img', { name: '2 and a half lives left' }).textContent).toBe('❤️❤️💔')
    cleanup()
    render(<HordeHud {...props({ lives: 0.5 })} />)
    expect(screen.getByRole('img', { name: 'Half a life left' }).textContent).toBe('💔')
    cleanup()
    render(<HordeHud {...props({ lives: 1 })} />)
    expect(screen.getByRole('img', { name: '1 life left' })).toBeTruthy()
  })

  it('shows the armor gem charges left, and none for a gem that has run out', () => {
    render(<HordeHud {...props({ armor: { reflect: 3, block: 0, mega: 1, heal: 0 } })} />)
    expect(screen.getByRole('status', { name: '3 reflects left: throws bounce back' }).textContent).toContain('3')
    expect(screen.getByRole('status', { name: '1 mega charge left: reflects or blocks' })).toBeTruthy()
    expect(screen.queryByRole('status', { name: /blocks? left/ })).toBeNull()
  })

  it('shows the heals left and the streak toward the next one', () => {
    render(<HordeHud {...props({ armor: { reflect: 0, block: 0, mega: 0, heal: 2 }, streak: 3 })} />)
    expect(screen.getByRole('status', { name: '2 heals left: 5 right answers in a row win back half a heart' })).toBeTruthy()
    const meter = screen.getByRole('meter', { name: 'Right answers in a row' })
    expect([meter.getAttribute('aria-valuenow'), meter.textContent]).toEqual(['3', '3/5'])
  })

  it('a reflect or block flashes in the worn skin’s colour; a heal flashes green', () => {
    const { container, rerender } = render(<HordeHud {...props({ armorColor: '#FFB020', feedback: { kind: 'reflect', id: 1 } })} />)
    expect(container.querySelector<HTMLElement>('[data-feedback-kind="reflect"]')?.style.background).toMatch(/#FFB020|255, 176, 32/i)
    rerender(<HordeHud {...props({ armorColor: '#FFB020', feedback: { kind: 'heal', id: 2 } })} />)
    expect(container.querySelector('[data-feedback-kind="heal"]')).toBeTruthy()
  })

  it('flashes a reflect and a block', () => {
    const { container, rerender } = render(<HordeHud {...props({ feedback: { kind: 'reflect', id: 1 } })} />)
    expect(container.querySelector('[data-feedback-kind="reflect"]')).toBeTruthy()
    rerender(<HordeHud {...props({ feedback: { kind: 'block', id: 2 } })} />)
    expect(container.querySelector('[data-feedback-kind="block"]')).toBeTruthy()
  })

  it('flags a moment for the recording', () => {
    const onFlag = vi.fn()
    render(<HordeHud {...props({ onFlag, flags: 2 })} />)
    fireEvent.click(screen.getByRole('button', { name: 'Flag this moment (2 flagged)' }))
    expect(onFlag).toHaveBeenCalledTimes(1)
  })

  it("I don't know asks for the answer, and is hidden when there's nothing to ask", () => {
    const onDontKnow = vi.fn()
    render(<HordeHud {...props({ onDontKnow })} />)
    fireEvent.click(screen.getByRole('button', { name: "I don't know" }))
    expect(onDontKnow).toHaveBeenCalledTimes(1)
    cleanup()
    render(<HordeHud {...props({ onDontKnow: null })} />)
    expect(screen.queryByRole('button', { name: "I don't know" })).toBeNull()
  })

  it('shows a revealed answer small in the top bar, leaving the question as it was', () => {
    render(<HordeHud {...props({ revealedAnswer: '3 + 4 = 7', onDontKnow: null })} />)
    expect(screen.getByRole('status', { name: 'The answer: 3 + 4 = 7' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Question' }).textContent).toBe('3 + 4 =')
  })

  it('says so for a moment when a push-back is earned', () => {
    render(<HordeHud {...props({ shoveEarned: true })} />)
    expect(screen.getByText('✋ +1 push-back for 3 right answers!')).toBeTruthy()
  })
})
