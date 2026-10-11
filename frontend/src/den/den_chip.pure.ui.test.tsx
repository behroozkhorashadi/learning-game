import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { DenChip } from './den_chip.pure.ui.tsx'

afterEach(cleanup)

describe('DenChip', () => {
  it('shows its label, with a decorative icon when given paths', () => {
    const { container } = render(<DenChip label="New" tone="green" iconPaths={['M0 0L1 1']} />)
    expect(screen.getByText('New')).toBeTruthy()
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
  })

  it('has no icon by default', () => {
    const { container } = render(<DenChip label="Plain" />)
    expect(container.querySelector('svg')).toBeNull()
  })
})
