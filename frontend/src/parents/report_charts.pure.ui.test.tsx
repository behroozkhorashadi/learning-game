import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { DailyChart, LevelPath, LineChart, Sparkline } from './report_charts.pure.ui.tsx'
import { sampleReport } from './parents_fixtures.test.lib.ts'

afterEach(cleanup)

const GAMES = [
  { id: 'zombie_horde', title: 'Zombie Horde' },
  { id: 'fact_fluency', title: 'Equation Outbreak' },
  { id: 'syllable_builder', title: 'Syllable Builder' },
  { id: 'pathfinder_no_way_back', title: 'Pathfinder' },
]

describe('DailyChart', () => {
  it('has a legend with the top three games and Other, and a tooltip per day', () => {
    const days = sampleReport(7).daily
    render(<DailyChart days={days} games={GAMES} />)
    const legend = screen.getByRole('list', { name: 'Legend' })
    expect(legend.textContent).toBe('Zombie HordeEquation OutbreakSyllable BuilderOther')
    const last = days[days.length - 1]
    if (last === undefined) throw new Error('fixture has days')
    const column = screen.getByLabelText(new RegExp(`^Oct 14: ${String(last.minutes)} min`))
    fireEvent.pointerEnter(column)
    expect(screen.getByRole('status').textContent).toContain('Wed Oct 14')
    expect(screen.getByRole('status').textContent).toContain('Zombie Horde')
  })

  it('has no legend for a single game', () => {
    render(<DailyChart days={sampleReport(7).daily} games={[{ id: 'zombie_horde', title: 'Zombie Horde' }]} />)
    expect(screen.queryByRole('list', { name: 'Legend' })).toBeNull()
  })
})

describe('LineChart', () => {
  it('shows every series at the hovered x, with gaps as a dash', () => {
    render(
      <LineChart
        xLabels={['Oct 5', 'Oct 12']}
        yMax={100}
        format={(v) => `${String(v)}%`}
        ariaLabel="Accuracy"
        series={[
          { label: 'Math', color: '#2a78d6', values: [60, 75] },
          { label: 'Reading', color: '#eb6834', values: [null, 90] },
        ]}
      />,
    )
    fireEvent.focus(screen.getByLabelText('Oct 5: Math 60%, Reading no data'))
    expect(screen.getByRole('status').textContent).toBe('Oct 560%Math—Reading')
  })
})

describe('small charts', () => {
  it('label themselves for screen readers', () => {
    render(
      <>
        <Sparkline values={[0, 5, 10]} label="Minutes per day" />
        <LevelPath title="Zombie Horde level" maxLevel={12} points={[{ at: '2026-10-01T00:00:00', level: 3 }, { at: '2026-10-10T00:00:00', level: 8 }]} />
        <LevelPath title="Empty" maxLevel={12} points={[]} />
      </>,
    )
    expect(screen.getByRole('img', { name: 'Minutes per day' })).toBeTruthy()
    expect(screen.getByRole('img', { name: 'Zombie Horde level: level 3 to 8 of 12' })).toBeTruthy()
    expect(screen.getByText('—')).toBeTruthy()
  })
})
