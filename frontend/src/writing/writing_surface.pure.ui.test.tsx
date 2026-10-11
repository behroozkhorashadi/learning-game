import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { words } from './writing_fixtures.test.lib.ts'
import { WritingSurface, type WritingSurfaceProps } from './writing_surface.pure.ui.tsx'

afterEach(cleanup)

function renderSurface(overrides: Partial<WritingSurfaceProps> = {}): WritingSurfaceProps {
  const props: WritingSurfaceProps = { briefTitle: 'Your forge', briefBody: 'A crow, a map.', briefChips: ['a crow', 'a map'], value: '', onChange: vi.fn(), onPolish: vi.fn(), wordGoal: 5, ...overrides }
  render(<WritingSurface {...props} />)
  return props
}

describe('WritingSurface', () => {
  it('reports typing and shows the brief', () => {
    const props = renderSurface()
    expect(screen.getByText('a crow')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Your draft'), { target: { value: 'Once' } })
    expect(props.onChange).toHaveBeenCalledWith('Once')
  })

  it('gates polishing behind the word goal and asks to confirm', () => {
    const props = renderSurface({ value: words(4) })
    // DenButton drops onClick when disabled rather than setting the attribute.
    fireEvent.click(screen.getByRole('button', { name: 'Ready to polish' }))
    expect(screen.queryByText('Ready to polish it?')).toBeNull()
    cleanup()
    const ready = renderSurface({ value: words(5) })
    fireEvent.click(screen.getByRole('button', { name: 'Ready to polish →' }))
    expect(screen.getByText('Ready to polish it?')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Yes, polish it' }))
    expect(ready.onPolish).toHaveBeenCalled()
    expect(props.onPolish).not.toHaveBeenCalled()
  })

  it('folds the brief away and back', () => {
    renderSurface()
    const toggle = screen.getByRole('button', { expanded: true })
    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
  })
})
