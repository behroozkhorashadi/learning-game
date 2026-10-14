import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { KidReport } from '@app/api/parents_schema.pure.lib.ts'
import { bindParentDashboard } from './parent_dashboard.effect.ui.tsx'
import { KID_SUMMARIES, MOM, sampleReport } from './parents_fixtures.test.lib.ts'

afterEach(cleanup)

/** A report loader whose answers settle when the test says. */
function deferredReports() {
  const pending: { days: number; resolve: (r: KidReport) => void }[] = []
  const loadReport = vi.fn((_parent: number, _kid: number, _password: string, days: number) => new Promise<KidReport>((resolve) => { pending.push({ days, resolve }) }))
  return { loadReport, pending }
}

describe('ParentDashboard', () => {
  it('lists the kids, opens one, and reloads the report for a new period', async () => {
    const reports = deferredReports()
    const listKids = vi.fn(() => Promise.resolve(KID_SUMMARIES))
    const Dashboard = bindParentDashboard({ listKids, loadReport: reports.loadReport })
    render(<Dashboard parent={MOM} password="pw" onSignOut={vi.fn()} />)

    fireEvent.click(await screen.findByRole('button', { name: "Open Rami's report" }))
    expect(listKids).toHaveBeenCalledWith(1, 'pw')
    expect(reports.loadReport).toHaveBeenLastCalledWith(1, 2, 'pw', 30)
    expect(screen.getByText('Loading the report…')).toBeTruthy()
    await act(async () => { reports.pending[0]?.resolve(sampleReport(30)) })
    expect(screen.getByRole('heading', { name: 'Rami' })).toBeTruthy()

    fireEvent.click(screen.getByRole('radio', { name: 'Last 7 days' }))
    expect(reports.loadReport).toHaveBeenLastCalledWith(1, 2, 'pw', 7)
    await act(async () => { reports.pending[1]?.resolve(sampleReport(7)) })
    expect(screen.getByRole('radio', { name: 'Last 7 days' }).getAttribute('aria-checked')).toBe('true')

    fireEvent.click(screen.getByRole('button', { name: '← All kids' }))
    expect(await screen.findByRole('button', { name: "Open Leila's report" })).toBeTruthy()
  })

  it('drops a late report for a period the parent already left', async () => {
    const reports = deferredReports()
    const Dashboard = bindParentDashboard({ listKids: () => Promise.resolve(KID_SUMMARIES), loadReport: reports.loadReport })
    render(<Dashboard parent={MOM} password="pw" onSignOut={vi.fn()} />)
    fireEvent.click(await screen.findByRole('button', { name: "Open Rami's report" }))
    fireEvent.click(screen.getByRole('radio', { name: 'Last 7 days' }))
    await act(async () => { reports.pending[1]?.resolve({ ...sampleReport(7), name: 'Seven' }) })
    await act(async () => { reports.pending[0]?.resolve({ ...sampleReport(30), name: 'Thirty' }) })
    expect(screen.getByRole('heading', { name: 'Seven' })).toBeTruthy()
  })

  it('signs out', async () => {
    const onSignOut = vi.fn()
    const Dashboard = bindParentDashboard({ listKids: () => Promise.resolve([]), loadReport: deferredReports().loadReport })
    render(<Dashboard parent={MOM} password="pw" onSignOut={onSignOut} />)
    expect(await screen.findByText('No kids linked yet.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(onSignOut).toHaveBeenCalled()
  })
})
