import type { z } from 'zod'
import { failureMessage, type HttpFetch, type HttpResponse } from './http.pure.lib.ts'
import type { components } from './openapi_schema.pure.lib.ts'
import { kidReportSchema, kidSummaryListSchema, parentListSchema, parentSchema, type KidReport, type KidSummary, type ParentRecord } from './parents_schema.pure.lib.ts'

/** Adapter for the parent endpoints (backend/app/parents/parents_routes_effect.py). */
export interface ParentsApi {
  readonly list: () => Promise<readonly ParentRecord[]>
  readonly create: (body: components['schemas']['ParentCreate']) => Promise<ParentRecord>
  /** Checks a parent's password (the admin password also unlocks it). */
  readonly unlock: (id: number, password: string) => Promise<'unlocked' | 'wrong-password'>
  /** Admin-only; the parent's kids stay, unlinked. */
  readonly remove: (id: number, adminPassword: string) => Promise<void>
  /** The family overview: each linked kid's last seven days. */
  readonly kids: (id: number, password: string) => Promise<readonly KidSummary[]>
  /** One linked kid's report over the last `days` days. */
  readonly report: (id: number, profileId: number, password: string, days: number) => Promise<KidReport>
}

const PATH = '/api/parents'
const JSON_HEADERS = { Accept: 'application/json', 'Content-Type': 'application/json' }

export function bindParentsApi({ fetch, baseUrl }: { readonly fetch: HttpFetch; readonly baseUrl: string }): ParentsApi {
  async function parsed<T>(response: HttpResponse, schema: z.ZodType<T>, what: string): Promise<T> {
    const result = schema.safeParse(await response.json())
    if (!result.success) throw new Error(`${what} returned an unexpected body: ${result.error.message}`)
    return result.data
  }

  async function get<T>(path: string, password: string, schema: z.ZodType<T>): Promise<T> {
    const response = await fetch(`${baseUrl}${path}`, { method: 'GET', headers: { Accept: 'application/json', 'X-Parent-Password': password } })
    if (!response.ok) throw new Error(await failureMessage(response, `GET ${path}`))
    return parsed(response, schema, `GET ${path}`)
  }

  return {
    list: async () => {
      const response = await fetch(`${baseUrl}${PATH}`, { method: 'GET', headers: { Accept: 'application/json' } })
      if (!response.ok) throw new Error(`GET ${PATH} failed with HTTP ${String(response.status)}`)
      return parsed(response, parentListSchema, `GET ${PATH}`)
    },
    create: async (body) => {
      const response = await fetch(`${baseUrl}${PATH}`, { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(body) })
      if (!response.ok) throw new Error(await failureMessage(response, `POST ${PATH}`))
      return parsed(response, parentSchema, `POST ${PATH}`)
    },
    unlock: async (id, password) => {
      const path = `${PATH}/${String(id)}/unlock`
      const body: components['schemas']['ParentUnlockRequest'] = { password }
      const response = await fetch(`${baseUrl}${path}`, { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(body) })
      if (response.status === 401) return 'wrong-password'
      if (!response.ok) throw new Error(`POST ${path} failed with HTTP ${String(response.status)}`)
      return 'unlocked'
    },
    remove: async (id, adminPassword) => {
      const path = `${PATH}/${String(id)}`
      const response = await fetch(`${baseUrl}${path}`, { method: 'DELETE', headers: { 'X-Admin-Password': adminPassword } })
      if (!response.ok) throw new Error(await failureMessage(response, `DELETE ${path}`))
    },
    kids: async (id, password) => get(`${PATH}/${String(id)}/kids`, password, kidSummaryListSchema),
    report: async (id, profileId, password, days) => get(`${PATH}/${String(id)}/kids/${String(profileId)}/report?days=${String(days)}`, password, kidReportSchema),
  }
}
