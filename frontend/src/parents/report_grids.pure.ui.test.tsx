import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { FactGrid, WhenHeatmap } from './report_grids.pure.ui.tsx'

afterEach(cleanup)

describe('WhenHeatmap', () => {
  it('labels every slot and describes the hovered one', () => {
    render(<WhenHeatmap cells={[{ weekday: 1, hour: 16, minutes: 47 }]} />)
    const busy = screen.getByLabelText('Tue 4 PM: 47 min')
    expect(screen.getByLabelText('Mon 4 PM: no play')).toBeTruthy()
    fireEvent.pointerEnter(busy)
    expect(screen.getByRole('status').textContent).toBe('Tue around 4 PM: 47 min')
  })
})

describe('FactGrid', () => {
  const cells = [
    { operator: '×', left: 7, right: 8, attempts: 4, first_try: 1 },
    { operator: '×', left: 2, right: 3, attempts: 2, first_try: 2 },
    { operator: '+', left: 1, right: 1, attempts: 3, first_try: 3 },
  ]

  it('has a tab per operation seen, starting with the first in teaching order', () => {
    render(<FactGrid cells={cells} />)
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Addition', 'Multiplication'])
    expect(screen.getByLabelText('1 + 1: 3 of 3 right on the first try')).toBeTruthy()
    expect(screen.getByRole('status').textContent).toBe('No shaky facts in this period.')
  })

  it('switches operation and calls out the shaky facts', () => {
    render(<FactGrid cells={cells} />)
    fireEvent.click(screen.getByRole('tab', { name: 'Multiplication' }))
    expect(screen.getByLabelText('7 × 8: 1 of 4 right on the first try')).toBeTruthy()
    expect(screen.getByLabelText('3 × 3: not seen')).toBeTruthy()
    expect(screen.getByRole('status').textContent).toBe('1 fact under 50% right on the first try (red).')
  })

  it('lays division out as a times table backwards', () => {
    render(<FactGrid cells={[{ operator: '÷', left: 35, right: 7, attempts: 3, first_try: 0 }]} />)
    expect(screen.getByLabelText('35 ÷ 7: 0 of 3 right on the first try')).toBeTruthy()
    expect(screen.getByLabelText('10 ÷ 2: not seen')).toBeTruthy()
  })

  it('says so when there are no facts', () => {
    render(<FactGrid cells={[]} />)
    expect(screen.getByText('No math facts answered in this period.')).toBeTruthy()
  })
})
