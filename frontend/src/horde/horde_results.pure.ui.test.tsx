import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { HordeResults, type HordeResultsProps } from './horde_results.pure.ui.tsx'

afterEach(cleanup)

function props(overrides: Partial<HordeResultsProps> = {}): HordeResultsProps {
  return {
    outcome: 'survived',
    beatClock: true,
    lastedMs: 72_000,
    newBest: false,
    lines: [
      { label: 'Right answers', count: 4, points: 20 },
      { label: 'Held out 60 seconds', count: 1, points: 50 },
    ],
    points: 70,
    bank: { kind: 'saved', balance: 170 },
    solved: [{ summary: '3 + 4 = 7', timeMs: 2000 }],
    onPlayAgain: vi.fn(),
    onBack: vi.fn(),
    ...overrides,
  }
}

describe('HordeResults', () => {
  it('shows the outcome, the points line by line, and the new balance', () => {
    render(<HordeResults {...props()} />)
    expect(screen.getByRole('heading', { name: 'You held off the horde!' })).toBeTruthy()
    expect(screen.getByRole('rowheader', { name: 'Right answers × 4' })).toBeTruthy()
    expect(screen.getByRole('table', { name: 'Points' }).textContent).toContain('⭐ 70')
    expect(screen.getByRole('status').textContent).toContain('170 points')
    expect(screen.getByText('3 + 4 = 7')).toBeTruthy()
  })

  it('says how long a round lasted when the horde got through in overtime, and celebrates a new best', () => {
    render(<HordeResults {...props({ outcome: 'overrun', lastedMs: 95_400, newBest: true })} />)
    expect(screen.getByRole('heading', { name: 'You lasted 1:35!' })).toBeTruthy()
    expect(screen.getByText('New personal best: 1:35!', { exact: false })).toBeTruthy()
  })

  it('no new best, no celebration', () => {
    render(<HordeResults {...props()} />)
    expect(screen.queryByText('New personal best', { exact: false })).toBeNull()
  })

  it('says when the horde got through, and when saving is in flight or failed', () => {
    render(<HordeResults {...props({ outcome: 'overrun', beatClock: false, lastedMs: 41_000, bank: { kind: 'saving' } })} />)
    expect(screen.getByRole('heading', { name: 'The horde got through!' })).toBeTruthy()
    expect(screen.getByText('Saving your points…')).toBeTruthy()
    cleanup()
    render(<HordeResults {...props({ bank: { kind: 'failed', message: 'offline' } })} />)
    expect(screen.getByRole('alert').textContent).toContain('offline')
  })

  it('plays again or goes back', () => {
    const onPlayAgain = vi.fn()
    const onBack = vi.fn()
    render(<HordeResults {...props({ onPlayAgain, onBack })} />)
    fireEvent.click(screen.getByRole('button', { name: 'Play again' }))
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(onPlayAgain).toHaveBeenCalledTimes(1)
    expect(onBack).toHaveBeenCalledTimes(1)
  })
})
