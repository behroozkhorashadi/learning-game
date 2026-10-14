import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LOADING, failed, loaded } from '@app/query/query_state.pure.lib.ts'
import { BadgesView, type BadgesViewProps } from './badges.pure.ui.tsx'
import { ART, BADGES, FIXTURE_NOW, NEW_PLAYER_STATS, STATS } from './badges_fixtures.test.lib.ts'

afterEach(cleanup)

function renderView(overrides: Partial<BadgesViewProps> = {}): BadgesViewProps {
  const props: BadgesViewProps = { state: loaded({ badges: BADGES, stats: STATS }), gallery: loaded(ART), kidName: 'Mia', now: FIXTURE_NOW, onBack: vi.fn(), painting: {}, onPaint: vi.fn(), animate: false, ...overrides }
  render(<BadgesView {...props} />)
  return props
}

describe('BadgesView', () => {
  it('shows the kid view by default: totals, then badges shelved by category', () => {
    renderView()
    expect(screen.getByText('Badges & prizes')).toBeTruthy()
    expect(screen.getByText('Badges earned').previousSibling?.textContent).toBe('3/8')
    expect(screen.getByText('Total stars').previousSibling?.textContent).toBe('12')
    const streaks = screen.getByRole('region', { name: 'Streaks' })
    expect(within(streaks).getByRole('button', { name: /^On a Roll: earned/ })).toBeTruthy()
    expect(within(streaks).getByRole('button', { name: 'Week Warrior: locked, 3 of 7 days in a row' })).toBeTruthy()
    expect(within(streaks).getByRole('img', { name: 'Week Warrior badge, silver, locked' })).toBeTruthy()
  })

  it('puts the locked badges closest to done up front', () => {
    renderView()
    const almost = screen.getByRole('region', { name: 'Almost there' })
    expect(within(almost).getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual([
      'Sharpshooter: locked, 22 of 25 right in a row',
      'Week Warrior: locked, 3 of 7 days in a row',
      'Champion: locked, 3 of 7 badges',
    ])
  })

  it('opens a locked badge to say how to get it, and how close it is', () => {
    renderView()
    fireEvent.click(within(screen.getByRole('region', { name: 'Right in a row' })).getByRole('button', { name: 'Sharpshooter: locked, 22 of 25 right in a row' }))
    const dialog = screen.getByRole('dialog', { name: 'Sharpshooter' })
    expect(within(dialog).getByRole('region', { name: 'How to get it' }).textContent).toContain('Get 25 answers right in a row')
    expect(within(dialog).getByRole('progressbar', { name: 'Progress toward Sharpshooter' }).getAttribute('aria-valuenow')).toBe('88')
    expect(within(dialog).getByText('3 more to go!')).toBeTruthy()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('opens an earned badge to say why it was earned, and offers to paint its art', () => {
    const { onPaint } = renderView()
    fireEvent.click(screen.getByRole('button', { name: /^Zombie Slayer: earned/ }))
    const dialog = screen.getByRole('dialog', { name: 'Zombie Slayer' })
    expect(within(dialog).getByRole('region', { name: 'Why you got it' }).textContent).toContain('You got 100 answers right in Zombie Horde!')
    expect(within(dialog).getByText(/while playing Zombie Horde$/)).toBeTruthy()
    expect(within(dialog).getByText('Your best so far: 188 right answers')).toBeTruthy()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Try painting again' }))
    expect(onPaint).toHaveBeenCalledWith('zombie-slayer')
  })

  it('shows painting in progress, and closes on Escape', () => {
    renderView({ painting: { 'zombie-slayer': 'painting' } })
    fireEvent.click(screen.getByRole('button', { name: /^Zombie Slayer: earned/ }))
    expect(screen.getByRole('status').textContent).toContain('Painting your one-of-a-kind badge')
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('opens the streak to the days played, with time and answers for each', () => {
    renderView()
    fireEvent.click(screen.getByRole('button', { name: 'Day streak: 3. See the days you played' }))
    const dialog = screen.getByRole('dialog', { name: 'Your streak' })
    expect(within(dialog).getByRole('heading', { name: '3 days in a row!' })).toBeTruthy()
    expect(within(dialog).getByText('Longest streak').previousSibling?.textContent).toBe('4')
    expect(within(dialog).getByRole('table', { name: 'Days played in the last six weeks' }).textContent).toContain('36 min, 80 rounds, part of your streak')
    const days = within(within(dialog).getByRole('region', { name: 'Day by day' })).getAllByRole('listitem')
    expect(days).toHaveLength(4)
    expect(days[0]?.textContent).toContain('36 min')
    expect(days[0]?.textContent).toContain('71 of 80 right (89%) · Zombie Horde')
  })

  it('switches to the parent view, with insights, and back', () => {
    renderView()
    fireEvent.click(screen.getByRole('button', { name: 'Switch to parent view' }))
    expect(screen.getByText('Progress summary')).toBeTruthy()
    expect(screen.getByText('Syllable Builder')).toBeTruthy()
    expect(screen.getByText('4.5/5 stars')).toBeTruthy()
    expect(screen.getByText('↑ 10% improvement this month')).toBeTruthy()
    expect(screen.getByText('1 hr 35 min in all · 36 min this week')).toBeTruthy()
    expect(screen.getByText('4 days in a row')).toBeTruthy()
    expect(screen.getAllByRole('button', { name: /: earned/ })).toHaveLength(3)
    fireEvent.click(screen.getByRole('button', { name: 'Switch to kid view' }))
    expect(screen.getByText('Badges & prizes')).toBeTruthy()
  })

  it('explains empty insights and an empty streak for a new player', () => {
    renderView({ state: loaded({ badges: [], stats: NEW_PLAYER_STATS }) })
    expect(screen.queryByRole('region', { name: 'Almost there' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Day streak: 0. See the days you played' }))
    expect(screen.getByRole('heading', { name: 'Start a new streak!' })).toBeTruthy()
    expect(screen.getByText('No days played yet. Your first one will show up here!')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    fireEvent.click(screen.getByRole('button', { name: 'Switch to parent view' }))
    for (const text of ['No games yet', 'No ratings yet', 'No sessions yet', 'Not enough history yet', 'No badges yet.']) expect(screen.getByText(text)).toBeTruthy()
  })

  it('shows the Zombie Horde art gallery in both views', () => {
    renderView()
    const gallery = screen.getByRole('region', { name: 'Zombie Horde art gallery' })
    expect(within(gallery).getByRole('img', { name: 'Comic Hero: a pet dragon' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Switch to parent view' }))
    expect(screen.getByRole('img', { name: 'Comic Hero: a pet dragon' })).toBeTruthy()
  })

  it('invites making art when the gallery is empty, and keeps the badges when it fails', () => {
    renderView({ gallery: loaded([]) })
    expect(screen.getByText('No art yet. Spend Zombie Horde points in the Art Studio to make some!')).toBeTruthy()
    cleanup()
    renderView({ gallery: failed('offline') })
    expect(screen.getByRole('alert').textContent).toBe("Your gallery couldn't load (offline).")
    expect(screen.getByRole('button', { name: /^Pattern Pro: earned/ })).toBeTruthy()
  })

  it('calls onBack', () => {
    const { onBack } = renderView()
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(onBack).toHaveBeenCalled()
  })

  it('renders loading and failed states', () => {
    renderView({ state: LOADING })
    expect(screen.getByRole('status').textContent).toBe('Loading your badges & prizes…')
    cleanup()
    renderView({ state: failed('GET /api/profiles/1/badges failed with HTTP 500') })
    expect(screen.getByRole('alert').textContent).toBe('Error: GET /api/profiles/1/badges failed with HTTP 500')
  })
})
