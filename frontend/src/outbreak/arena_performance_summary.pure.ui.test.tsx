import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ArenaPerformanceSummary } from './arena_performance_summary.pure.ui.tsx'

afterEach(cleanup)

describe('ArenaPerformanceSummary', () => {
  it('shows right answers, average time, and every question in order', () => {
    render(
      <ArenaPerformanceSummary
        results={[
          { question: '3 + 4 = 7', correct: true, timeTakenMs: 1500 },
          { question: '6 + 3 = 9', correct: false, timeTakenMs: 2500 },
        ]}
      />,
    )
    expect(screen.getByText('1 / 2')).toBeTruthy()
    expect(screen.getByText('2.0s')).toBeTruthy()
    const rows = within(screen.getByRole('list', { name: 'Questions' })).getAllByRole('listitem')
    expect(rows.map((r) => r.textContent)).toEqual(['3 + 4 = 7Correct1.5s', '6 + 3 = 9Missed2.5s'])
  })

  it('reads 0 / 0 and 0.0s before anything is answered', () => {
    render(<ArenaPerformanceSummary results={[]} />)
    expect(screen.getByText('0 / 0')).toBeTruthy()
    expect(screen.getByText('0.0s')).toBeTruthy()
  })
})
