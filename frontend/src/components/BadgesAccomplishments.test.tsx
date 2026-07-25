import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { BadgesAccomplishments } from './BadgesAccomplishments'

afterEach(() => cleanup())

describe('BadgesAccomplishments', () => {
  it('shows the kid view by default with earned and locked badges', () => {
    render(<BadgesAccomplishments kidName="Mia" onBack={vi.fn()} />)

    expect(screen.getByText('Your badges')).toBeTruthy()
    expect(screen.getByText('Word Wizard')).toBeTruthy()
    expect(screen.getAllByText('Locked').length).toBeGreaterThan(0)
  })

  it('switches to the parent view and back', () => {
    render(<BadgesAccomplishments kidName="Mia" onBack={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Switch to parent view' }))
    expect(screen.getByText('Progress summary')).toBeTruthy()
    expect(screen.getByText('Learning insights')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Switch to kid view' }))
    expect(screen.getByText('Your badges')).toBeTruthy()
  })

  it('calls onBack when the back button is pressed', () => {
    const onBack = vi.fn()
    render(<BadgesAccomplishments kidName="Mia" onBack={onBack} />)

    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(onBack).toHaveBeenCalled()
  })
})
