import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CoachPanel, type CoachPanelProps } from './coach_panel.pure.ui.tsx'
import { QUESTIONS } from './writing_fixtures.test.lib.ts'

afterEach(cleanup)

function renderPanel(overrides: Partial<CoachPanelProps> = {}): CoachPanelProps {
  const props: CoachPanelProps = { pieceTitle: 'The crow', value: 'one two three', onChange: vi.fn(), status: 'questions', questions: QUESTIONS, onHappy: vi.fn(), ...overrides }
  render(<CoachPanel {...props} />)
  return props
}

describe('CoachPanel', () => {
  it('shows the questions and lets the kid revise', () => {
    const props = renderPanel()
    expect(screen.getByText('How does it start?')).toBeTruthy()
    expect(screen.getByText('2 things I noticed')).toBeTruthy()
    expect(screen.getByText('3 words · 2 asks')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Your story'), { target: { value: 'changed' } })
    expect(props.onChange).toHaveBeenCalledWith('changed')
  })

  it('unlocks "happy" once a question is answered, or as the caller says', () => {
    const props = renderPanel()
    fireEvent.click(screen.getByRole('button', { name: "I'm happy with it" }))
    expect(props.onHappy).toHaveBeenCalled()
    cleanup()
    const blocked = renderPanel({ questions: [], happyReady: false })
    // DenButton drops onClick when disabled rather than setting the attribute.
    fireEvent.click(screen.getByRole('button', { name: "I'm happy with it" }))
    expect(blocked.onHappy).not.toHaveBeenCalled()
  })

  it('shows thinking and done states', () => {
    renderPanel({ status: 'thinking', questions: [] })
    expect(screen.getByText('Give me a second…')).toBeTruthy()
    cleanup()
    renderPanel({ status: 'done' })
    expect(screen.getByRole('button', { name: 'See my picture →' })).toBeTruthy()
  })
})
