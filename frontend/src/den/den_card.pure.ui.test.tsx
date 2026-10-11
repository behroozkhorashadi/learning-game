import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { DenCard } from './den_card.pure.ui.tsx'

afterEach(cleanup)

describe('DenCard', () => {
  it('shows the header, body, and footer it is given', () => {
    render(
      <DenCard kicker="Round 2" title="Zombie wave" meta="3/5" footerNote="Keep going" footerSlot={<button type="button">Next</button>}>
        <p>Body</p>
      </DenCard>,
    )
    for (const text of ['Round 2', 'Zombie wave', '3/5', 'Body', 'Keep going']) expect(screen.getByText(text)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Next' })).toBeTruthy()
  })

  it('leaves out an empty header and footer', () => {
    const { container } = render(<DenCard>only body</DenCard>)
    expect(container.textContent).toBe('only body')
  })
})
