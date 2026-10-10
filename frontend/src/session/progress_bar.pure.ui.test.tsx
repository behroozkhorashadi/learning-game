import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ProgressBar } from './progress_bar.pure.ui.tsx'

afterEach(cleanup)

/** Done dots are the ones carrying the check icon. */
function doneDots(): number {
  return screen.getByLabelText(/^Item \d+ of \d+$/).querySelectorAll('svg').length
}

describe('ProgressBar', () => {
  it('announces the current item and shows it in the counter', () => {
    render(<ProgressBar total={5} currentIndex={1} onBack={vi.fn()} />)
    expect(screen.getByLabelText('Item 2 of 5')).toBeTruthy()
    expect(screen.getByText('2')).toBeTruthy()
    expect(screen.getByText('/ 5')).toBeTruthy()
  })

  it('draws one dot per item, with a check on every finished one', () => {
    render(<ProgressBar total={5} currentIndex={3} onBack={vi.fn()} />)
    expect(screen.getByLabelText('Item 4 of 5').children).toHaveLength(5)
    expect(doneDots()).toBe(3)
  })

  it('clamps the counter at the total once every item is done', () => {
    render(<ProgressBar total={3} currentIndex={3} onBack={vi.fn()} />)
    expect(screen.getByText('3')).toBeTruthy()
    expect(doneDots()).toBe(3)
  })

  it('calls onBack from the Back button', () => {
    const onBack = vi.fn()
    render(<ProgressBar total={3} currentIndex={0} onBack={onBack} />)
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(onBack).toHaveBeenCalledTimes(1)
  })
})
