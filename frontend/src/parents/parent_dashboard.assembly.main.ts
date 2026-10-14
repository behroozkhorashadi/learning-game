import type { ComponentType } from 'react'
import { bindParentsApi } from '@app/api/parents_api.effect.lib.ts'
import { bindParentDashboard, type ParentDashboardProps } from './parent_dashboard.effect.ui.tsx'

/** The parent dashboard over the real API. Called once by the app shell. */
export function assembleParentDashboard(): ComponentType<ParentDashboardProps> {
  const api = bindParentsApi({ fetch: async (url, init) => fetch(url, init), baseUrl: '' })
  return bindParentDashboard({ listKids: api.kids, loadReport: api.report })
}
