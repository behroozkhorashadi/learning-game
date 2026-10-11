import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { EquationDisplay } from './equation_display.pure.ui.tsx'
import { equation } from './equation_fixtures.test.lib.ts'

afterEach(cleanup)

describe('EquationDisplay', () => {
  it('shows every part but the missing one, which is a blank', () => {
    const { container } = render(<EquationDisplay payload={{ ...equation(7, []), missing: 'left' }} />)
    expect(screen.getByRole('img', { name: 'missing' })).toBeTruthy()
    expect(container.textContent).toBe('?+4=7')
  })
})
