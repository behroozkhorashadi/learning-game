import { useMemo, useState, type ComponentType, type ReactElement } from 'react'
import type { KidReport, KidSummary, ParentRecord } from '@app/api/parents_schema.pure.lib.ts'
import { useQuery } from '@app/query/use_query.pure.hook.ts'
import { FamilyOverview } from './family_overview.pure.ui.tsx'
import { KidReportView } from './kid_report.pure.ui.tsx'
import type { RangeDays } from './report_format.pure.lib.ts'

/**
 * The parent dashboard: the family overview, and one kid's report when the
 * parent opens it. The parent is already signed in; `password` is the one
 * they signed in with, sent on every read.
 */

/** Key this screen by `parent.id`. */
export interface ParentDashboardProps {
  readonly parent: ParentRecord
  readonly password: string
  readonly onSignOut: () => void
}

export interface ParentDashboardDeps {
  /** GET /api/parents/{id}/kids. */
  readonly listKids: (parentId: number, password: string) => Promise<readonly KidSummary[]>
  /** GET /api/parents/{id}/kids/{profile_id}/report?days=. */
  readonly loadReport: (parentId: number, profileId: number, password: string, days: number) => Promise<KidReport>
}

export function bindParentDashboard({ listKids, loadReport }: ParentDashboardDeps): ComponentType<ParentDashboardProps> {
  function KidReportScreen({ parent, password, kid, onBack }: { readonly parent: ParentRecord; readonly password: string; readonly kid: KidSummary; readonly onBack: () => void }): ReactElement {
    const [days, setDays] = useState<RangeDays>(30)
    // One load per period: changing the period starts a new one, and a late answer for the old period is dropped.
    const load = useMemo(() => () => loadReport(parent.id, kid.profile_id, password, days), [parent.id, kid.profile_id, password, days])
    const state = useQuery(load)
    return <KidReportView state={state} days={days} onDaysChange={setDays} onBack={onBack} />
  }

  function ParentDashboard({ parent, password, onSignOut }: ParentDashboardProps): ReactElement {
    const [open, setOpen] = useState<KidSummary | null>(null)
    const loadKids = useMemo(() => () => listKids(parent.id, password), [parent.id, password])
    const kids = useQuery(loadKids)
    if (open !== null) return <KidReportScreen key={open.profile_id} parent={parent} password={password} kid={open} onBack={() => { setOpen(null) }} />
    return <FamilyOverview parent={parent} state={kids} onOpenKid={setOpen} onSignOut={onSignOut} />
  }
  return ParentDashboard
}
