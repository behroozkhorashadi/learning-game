import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LOADING, failed, loaded } from '@app/query/query_state.pure.lib.ts'
import { KidReportView, type KidReportViewProps } from './kid_report.pure.ui.tsx'
import { emptyReport, sampleReport } from './parents_fixtures.test.lib.ts'

afterEach(cleanup)

function renderView(overrides: Partial<KidReportViewProps> = {}): KidReportViewProps {
  const props: KidReportViewProps = { state: loaded(sampleReport()), days: 30, onDaysChange: vi.fn(), onBack: vi.fn(), ...overrides }
  render(<KidReportView {...props} />)
  return props
}

describe('KidReportView', () => {
  it('leads with the findings, grouped as things to watch, wins, and notes', () => {
    renderView()
    const findings = screen.getByRole('region', { name: 'Findings' })
    expect(within(findings).getByText('Keep an eye on')).toBeTruthy()
    expect(within(findings).getByText('Keeps missing 7 × 8 = ?')).toBeTruthy()
    expect(within(findings).getByText('Wins')).toBeTruthy()
    expect(within(findings).getByText('Good to know')).toBeTruthy()
  })

  it('shows the period at a glance against the period before', () => {
    renderView()
    const glance = screen.getByRole('region', { name: 'At a glance' })
    expect(within(glance).getByText('6 h 52 min')).toBeTruthy()
    expect(within(glance).getByText('▲ +7 pts vs before')).toBeTruthy()
    expect(within(glance).getByText('▼ −0.9s vs before')).toBeTruthy()
    expect(within(glance).getByText('19 of 30')).toBeTruthy()
  })

  it('has every section a parent reads', () => {
    renderView()
    for (const name of ['How much they play', 'When they play', 'Skills', 'Problems they keep missing', 'Math facts', 'Getting better?', 'Math speed', 'Games', 'Recent badges']) {
      expect(screen.getByRole('region', { name })).toBeTruthy()
    }
    expect(screen.getByRole('meter', { name: 'Division: 17% right on the first try' })).toBeTruthy()
    expect(screen.getByText('35 ÷ 7 = ?')).toBeTruthy()
    expect(screen.getByText('4 puzzles solved (11 all time)')).toBeTruthy()
  })

  it('changes the period and goes back', () => {
    const props = renderView()
    fireEvent.click(screen.getByRole('radio', { name: 'Last 7 days' }))
    expect(props.onDaysChange).toHaveBeenCalledWith(7)
    expect(screen.getByRole('radio', { name: 'Last 30 days' }).getAttribute('aria-checked')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: '← All kids' }))
    expect(props.onBack).toHaveBeenCalled()
  })

  it('stays calm with nothing to show', () => {
    renderView({ state: loaded(emptyReport()) })
    expect(screen.getAllByText('No play in this period.')).toHaveLength(2)
    expect(screen.getByText("Hasn't played yet")).toBeTruthy()
    expect(screen.queryByRole('region', { name: 'Math facts' })).toBeNull()
  })

  it('shows loading and failure', () => {
    renderView({ state: LOADING })
    expect(screen.getByText('Loading the report…')).toBeTruthy()
    cleanup()
    renderView({ state: failed('HTTP 500') })
    expect(screen.getByRole('alert').textContent).toBe("Couldn't load the report: HTTP 500")
  })
})
