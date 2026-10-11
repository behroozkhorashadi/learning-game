import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { draftFrom } from './outbreak_settings_form.pure.lib.ts'
import { OutbreakSettingsView, type OutbreakSettingsViewProps } from './outbreak_settings.pure.ui.tsx'

afterEach(cleanup)

function renderView(overrides: Partial<OutbreakSettingsViewProps> = {}): OutbreakSettingsViewProps {
  const props: OutbreakSettingsViewProps = { draft: { ...draftFrom(null), custom: true }, onChange: vi.fn(), saving: false, error: null, onSave: vi.fn(), onCancel: vi.fn(), ...overrides }
  render(<OutbreakSettingsView {...props} />)
  return props
}

describe('OutbreakSettingsView', () => {
  it('reports each edit as a new draft', () => {
    const props = renderView()
    fireEvent.click(screen.getByRole('button', { name: '+' }))
    expect(props.onChange).toHaveBeenLastCalledWith(expect.objectContaining({ operations: ['-', '×', '÷'] }))
    fireEvent.click(within(screen.getByRole('group', { name: 'Focus numbers for addition' })).getByRole('button', { name: '7' }))
    expect(props.onChange).toHaveBeenLastCalledWith(expect.objectContaining({ focusNumbers: { '+': [7] } }))
    fireEvent.change(screen.getByRole('slider'), { target: { value: '9' } })
    expect(props.onChange).toHaveBeenLastCalledWith(expect.objectContaining({ difficulty: 9 }))
  })

  it('names the difficulty band', () => {
    renderView({ draft: { ...draftFrom(null), custom: true, difficulty: 2 } })
    expect(screen.getByText('Difficulty — Warm-up (2/10)')).toBeTruthy()
  })

  it('shows an error, and Saving… while it saves', () => {
    const props = renderView({ error: 'Pick at least one operation', saving: true })
    expect(screen.getByRole('alert').textContent).toBe('Pick at least one operation')
    fireEvent.click(screen.getByRole('button', { name: 'Saving…' }))
    expect(props.onSave).not.toHaveBeenCalled()
  })

  it('saves and cancels', () => {
    const props = renderView()
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect([vi.mocked(props.onSave).mock.calls.length, vi.mocked(props.onCancel).mock.calls.length]).toEqual([1, 1])
  })
})
