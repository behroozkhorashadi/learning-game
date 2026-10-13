import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LOADING, failed, loaded } from '@app/query/query_state.pure.lib.ts'
import { BadgesView, type BadgesViewProps } from './badges.pure.ui.tsx'
import { ART, BADGES, NEW_PLAYER_STATS, STATS } from './badges_fixtures.test.lib.ts'

afterEach(cleanup)

function renderView(overrides: Partial<BadgesViewProps> = {}): BadgesViewProps {
  const props: BadgesViewProps = { state: loaded({ badges: BADGES, stats: STATS }), gallery: loaded(ART), kidName: 'Mia', now: new Date('2026-01-05T15:00:00Z'), onBack: vi.fn(), ...overrides }
  render(<BadgesView {...props} />)
  return props
}

describe('BadgesView', () => {
  it('shows the kid view by default with earned and locked badges and the totals', () => {
    renderView()
    expect(screen.getByText('Badges & prizes')).toBeTruthy()
    expect(screen.getByRole('img', { name: 'Word Wizard' })).toBeTruthy()
    expect(screen.getByText('Locked')).toBeTruthy()
    expect(screen.getByText('Badges earned').previousSibling?.textContent).toBe('1')
    expect(screen.getByText('Total stars').previousSibling?.textContent).toBe('12')
  })

  it('switches to the parent view, with insights, and back', () => {
    renderView()
    fireEvent.click(screen.getByRole('button', { name: 'Switch to parent view' }))
    expect(screen.getByText('Progress summary')).toBeTruthy()
    expect(screen.getByText('Syllable Builder')).toBeTruthy()
    expect(screen.getByText('4.5/5 stars')).toBeTruthy()
    expect(screen.getByText('↑ 10% improvement this month')).toBeTruthy()
    expect(screen.getByText(/^Today at /)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Switch to kid view' }))
    expect(screen.getByText('Badges & prizes')).toBeTruthy()
  })

  it('explains empty insights for a new player', () => {
    renderView({ state: loaded({ badges: [], stats: NEW_PLAYER_STATS }) })
    fireEvent.click(screen.getByRole('button', { name: 'Switch to parent view' }))
    for (const text of ['No games yet', 'No ratings yet', 'No sessions yet', 'Not enough history yet']) expect(screen.getByText(text)).toBeTruthy()
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
    expect(screen.getByRole('img', { name: 'Word Wizard' })).toBeTruthy()
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

  it('falls back to sparkles when badge art is missing', () => {
    renderView()
    fireEvent.error(screen.getByRole('img', { name: 'Word Wizard' }))
    expect(screen.queryByRole('img', { name: 'Word Wizard' })).toBeNull()
  })
})
