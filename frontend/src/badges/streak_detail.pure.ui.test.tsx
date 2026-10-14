import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { StreakDetail } from './streak_detail.pure.ui.tsx'
import { FIXTURE_NOW, NEW_PLAYER_STATS, STATS } from './badges_fixtures.test.lib.ts'

afterEach(cleanup)

describe('StreakDetail', () => {
  it('shows the streak, the totals, and six weeks of days', () => {
    render(<StreakDetail stats={STATS} today={FIXTURE_NOW} onClose={vi.fn()} />)
    expect(screen.getByRole('heading', { name: '3 days in a row!' })).toBeTruthy()
    expect(screen.getByText('All time').previousSibling?.textContent).toBe('1 hr 35 min')
    const table = screen.getByRole('table', { name: 'Days played in the last six weeks' })
    expect(within(table).getAllByRole('row')).toHaveLength(7) // the weekday header + six weeks
    expect(within(table).getByRole('columnheader', { name: 'Mon' })).toBeTruthy()
    expect(table.textContent).toContain('not played')
  })

  it('lists each day played with its time, answers, and games', () => {
    render(<StreakDetail stats={STATS} today={FIXTURE_NOW} onClose={vi.fn()} />)
    const days = within(screen.getByRole('region', { name: 'Day by day' })).getAllByRole('listitem')
    expect(days.map((d) => d.textContent)).toEqual([
      expect.stringContaining('36 min71 of 80 right (89%) · Zombie Horde'),
      expect.stringContaining('22 min40 of 45 right (89%) · Zombie Horde, Equation Outbreak'),
      expect.stringContaining('4 min12 of 12 right (100%) · Equation Outbreak'),
      expect.stringContaining('10 minNo answers'),
    ])
  })

  it('invites a new player to start a streak, and closes', () => {
    const onClose = vi.fn()
    render(<StreakDetail stats={NEW_PLAYER_STATS} today={FIXTURE_NOW} onClose={onClose} />)
    expect(screen.getByText('Play today to light the first flame.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalled()
  })
})
