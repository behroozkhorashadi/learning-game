import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { BadgeMedal } from './badge_medal.pure.ui.tsx'
import { CHAMPION, PATTERN_PRO, SHARPSHOOTER, STREAK_BADGE, badge } from './badges_fixtures.test.lib.ts'

afterEach(cleanup)

describe('BadgeMedal', () => {
  it('names the badge, its tier, and whether it is earned', () => {
    render(<BadgeMedal badge={STREAK_BADGE} size={96} />)
    expect(screen.getByRole('img', { name: 'On a Roll badge, bronze, earned' })).toBeTruthy()
    cleanup()
    render(<BadgeMedal badge={CHAMPION} size={96} />)
    expect(screen.getByRole('img', { name: 'Champion badge, legendary, locked' })).toBeTruthy()
  })

  it('fills the face with the painted art once it is ready, and not before', () => {
    const { container } = render(<BadgeMedal badge={PATTERN_PRO} size={96} />)
    expect(container.querySelector('image')?.getAttribute('href')).toBe('/images/badges/syllable_builder.png')
    cleanup()
    const pending = render(<BadgeMedal badge={{ ...PATTERN_PRO, art_status: 'pending' }} size={96} />)
    expect(pending.container.querySelector('image')).toBeNull()
  })

  it('locks an unearned medal with a ring as long as its progress', () => {
    const { container } = render(<BadgeMedal badge={SHARPSHOOTER} size={96} />)
    const dash = container.querySelector('circle[stroke="#5BCC2D"]')?.getAttribute('stroke-dasharray') ?? ''
    const [filled = '0', whole = '1'] = dash.split(' ')
    expect(Number(filled) / Number(whole)).toBeCloseTo(0.88, 2)
  })

  it('shines only when earned and asked to', () => {
    const shine = (b: typeof STREAK_BADGE, animate: boolean): boolean => {
      const { container } = render(<BadgeMedal badge={b} size={96} animate={animate} />)
      const found = container.querySelector('.badge-shine') !== null
      cleanup()
      return found
    }
    expect([shine(STREAK_BADGE, true), shine(STREAK_BADGE, false), shine(badge({ earned: false }), true)]).toEqual([true, false, false])
  })
})
