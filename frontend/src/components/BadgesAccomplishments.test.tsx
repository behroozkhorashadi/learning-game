import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { BadgesAccomplishments } from './BadgesAccomplishments'
import type { BadgeStatus, ProfileStats } from '../types/generated'

afterEach(() => cleanup())

const BADGES: BadgeStatus[] = [
  { key: 'word-wizard', name: 'Word Wizard', description: 'Wrote and finished your first story', art_url: '/images/badges/word-wizard.png', earned: true, awarded_at: '2026-01-05T00:00:00Z' },
  { key: 'sound-master', name: 'Sound Master', description: '20 correct answers in Syllable Builder', art_url: '/images/badges/sound-master.png', earned: false, awarded_at: null },
]

const STATS: ProfileStats = {
  total_stars: 12,
  day_streak: 3,
  minutes_this_week: 20,
  most_played_game: 'Syllable Builder',
  avg_rating: 4.5,
  last_session_at: '2026-01-05T12:00:00Z',
  progress_delta_pct: 10,
}

function mockFetch(badges: BadgeStatus[], stats: ProfileStats) {
  return vi.fn((url: string) => {
    if (url === '/api/profiles/1/badges') return Promise.resolve({ ok: true, json: () => Promise.resolve(badges) } as Response)
    if (url === '/api/profiles/1/stats') return Promise.resolve({ ok: true, json: () => Promise.resolve(stats) } as Response)
    return Promise.reject(new Error(`unexpected fetch ${url}`))
  })
}

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch(BADGES, STATS))
})

describe('BadgesAccomplishments', () => {
  it('shows the kid view by default with earned and locked badges', async () => {
    render(<BadgesAccomplishments profileId={1} kidName="Mia" onBack={vi.fn()} />)

    await waitFor(() => expect(screen.getByText('Your badges')).toBeTruthy())
    expect(screen.getByText('Word Wizard')).toBeTruthy()
    expect(screen.getAllByText('Locked').length).toBeGreaterThan(0)
  })

  it('switches to the parent view and back', async () => {
    render(<BadgesAccomplishments profileId={1} kidName="Mia" onBack={vi.fn()} />)

    await waitFor(() => expect(screen.getByText('Your badges')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Switch to parent view' }))
    expect(screen.getByText('Progress summary')).toBeTruthy()
    expect(screen.getByText('Learning insights')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Switch to kid view' }))
    expect(screen.getByText('Your badges')).toBeTruthy()
  })

  it('calls onBack when the back button is pressed', async () => {
    const onBack = vi.fn()
    render(<BadgesAccomplishments profileId={1} kidName="Mia" onBack={onBack} />)

    await waitFor(() => expect(screen.getByText('Your badges')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(onBack).toHaveBeenCalled()
  })

  it('shows an error message when the fetch fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ ok: false, status: 500 } as Response))
    )

    render(<BadgesAccomplishments profileId={1} kidName="Mia" onBack={vi.fn()} />)

    await waitFor(() => expect(screen.getByText(/Error:/)).toBeTruthy())
  })
})
