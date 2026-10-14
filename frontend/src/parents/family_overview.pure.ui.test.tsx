import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LOADING, failed, loaded } from '@app/query/query_state.pure.lib.ts'
import { FamilyOverview, type FamilyOverviewProps } from './family_overview.pure.ui.tsx'
import { KID_SUMMARIES, MOM, RAMI_SUMMARY } from './parents_fixtures.test.lib.ts'

afterEach(cleanup)

function renderView(overrides: Partial<FamilyOverviewProps> = {}): FamilyOverviewProps {
  const props: FamilyOverviewProps = { parent: MOM, state: loaded(KID_SUMMARIES), onOpenKid: vi.fn(), onSignOut: vi.fn(), ...overrides }
  render(<FamilyOverview {...props} />)
  return props
}

describe('FamilyOverview', () => {
  it('has a card per kid with the week at a glance and their top finding', () => {
    const props = renderView()
    const rami = screen.getByRole('button', { name: "Open Rami's report" })
    expect(rami.textContent).toContain('1 h 14 min')
    expect(rami.textContent).toContain('5 of 7')
    expect(rami.textContent).toContain('Multiplication needs practice')
    expect(rami.textContent).toContain('1 more thing to watch')
    fireEvent.click(rami)
    expect(props.onOpenKid).toHaveBeenCalledWith(RAMI_SUMMARY)
  })

  it('explains how to link a kid when there are none', () => {
    renderView({ state: loaded([]) })
    expect(screen.getByText('No kids linked yet.')).toBeTruthy()
  })

  it('signs out, and shows loading and failure', () => {
    const props = renderView({ state: LOADING })
    expect(screen.getByText('Loading…')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(props.onSignOut).toHaveBeenCalled()
    cleanup()
    renderView({ state: failed('HTTP 401') })
    expect(screen.getByRole('alert').textContent).toBe("Couldn't load your kids: HTTP 401")
  })
})
