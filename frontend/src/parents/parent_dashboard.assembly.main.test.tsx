import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { assembleParentDashboard } from './parent_dashboard.assembly.main.ts'
import { KID_SUMMARIES, MOM, sampleReport } from './parents_fixtures.test.lib.ts'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('assembleParentDashboard', () => {
  it('reads the overview and a report with the parent password', async () => {
    const fetchFake = vi.fn((url: string, _init?: RequestInit) => Promise.resolve(new Response(JSON.stringify(url.includes('/report') ? sampleReport() : KID_SUMMARIES), { status: 200 })))
    vi.stubGlobal('fetch', fetchFake)
    const Dashboard = assembleParentDashboard()
    render(<Dashboard parent={MOM} password="pw" onSignOut={vi.fn()} />)
    fireEvent.click(await screen.findByRole('button', { name: "Open Rami's report" }))
    expect(await screen.findByRole('region', { name: 'Findings' })).toBeTruthy()
    const sent = fetchFake.mock.calls.map(([url, init]) => [url, new Headers(init?.headers).get('X-Parent-Password')])
    expect(sent).toEqual([
      ['/api/parents/1/kids', 'pw'],
      ['/api/parents/1/kids/2/report?days=30', 'pw'],
    ])
  })
})
