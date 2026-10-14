import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BadgeDetail, type BadgeDetailProps } from './badge_detail.pure.ui.tsx'
import { JUST_EARNED, PATTERN_PRO, SHARPSHOOTER, STREAK_BADGE } from './badges_fixtures.test.lib.ts'

afterEach(cleanup)

function renderDetail(overrides: Partial<BadgeDetailProps>): BadgeDetailProps {
  const props: BadgeDetailProps = { badge: SHARPSHOOTER, paint: 'idle', onPaint: vi.fn(), onClose: vi.fn(), animate: false, ...overrides }
  render(<BadgeDetail {...props} />)
  return props
}

describe('BadgeDetail', () => {
  it('tells how to get a locked badge, and how close it is', () => {
    renderDetail({})
    expect(screen.getByRole('heading', { name: 'Sharpshooter' })).toBeTruthy()
    expect(screen.getByText('Not earned yet')).toBeTruthy()
    expect(screen.getByRole('region', { name: 'How to get it' }).textContent).toContain('Get 25 answers right in a row')
    expect(screen.getByRole('progressbar').getAttribute('aria-valuetext')).toBe('22 of 25 right in a row')
    expect(screen.queryByRole('region', { name: 'Your own badge art' })).toBeNull()
  })

  it('tells why an earned badge was earned, and that its art was painted for the kid', () => {
    renderDetail({ badge: PATTERN_PRO })
    expect(screen.getByRole('region', { name: 'Why you got it' }).textContent).toContain('You got 10 answers right in a row!')
    expect(screen.getByText('Your best so far: 47 right in a row')).toBeTruthy()
    expect(screen.getByText('This badge was painted just for you. No one else has one like it!')).toBeTruthy()
  })

  it('offers to paint art the badge never got', () => {
    const { onPaint } = renderDetail({ badge: STREAK_BADGE })
    fireEvent.click(screen.getByRole('button', { name: 'Paint my badge' }))
    expect(onPaint).toHaveBeenCalled()
  })

  it('says the art is on its way while it paints', () => {
    renderDetail({ badge: JUST_EARNED })
    expect(within(screen.getByRole('region', { name: 'Your own badge art' })).getByRole('status').textContent).toContain('this takes a few seconds')
  })

  it('closes from its button or Escape', () => {
    const { onClose } = renderDetail({})
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Sharpshooter' }), { key: 'Escape' })
    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Sharpshooter' }), { key: 'Enter' })
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})
