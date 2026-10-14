import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BadgeCelebration, BadgeToast } from './badge_celebration.pure.ui.tsx'
import { JUST_EARNED, PATTERN_PRO } from './badges_fixtures.test.lib.ts'

afterEach(cleanup)

describe('BadgeCelebration', () => {
  it('throws a party for the new badge, saying why it was earned, while its art paints', () => {
    const onDone = vi.fn()
    const { container } = render(<BadgeCelebration badge={JUST_EARNED} remaining={0} animate onDone={onDone} />)
    expect(screen.getByRole('dialog', { name: 'New badge!' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'On a Roll' })).toBeTruthy()
    expect(screen.getByText('You played 3 days in a row!')).toBeTruthy()
    expect(screen.getByRole('status').textContent).toContain('Painting your one-of-a-kind badge art')
    expect(container.querySelectorAll('.badge-confetti').length).toBeGreaterThan(20)
    fireEvent.click(screen.getByRole('button', { name: 'Awesome!' }))
    expect(onDone).toHaveBeenCalled()
  })

  it('says how many more are waiting, shows painted art, and skips confetti without motion', () => {
    const { container } = render(<BadgeCelebration badge={PATTERN_PRO} remaining={2} animate={false} onDone={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Next badge (2 more)' })).toBeTruthy()
    expect(screen.getByText('✨ Painted just for you!')).toBeTruthy()
    expect(container.querySelector('.badge-confetti')).toBeNull()
  })
})

describe('BadgeToast', () => {
  it('announces the badge without taking a click', () => {
    render(<BadgeToast badge={PATTERN_PRO} />)
    const toast = screen.getByRole('status')
    expect(toast.textContent).toContain('New badge!Pattern Pro')
    expect(toast.style.pointerEvents).toBe('none')
  })
})
