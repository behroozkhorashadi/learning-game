import type { HttpFetch } from './http.pure.lib.ts'
import type { components } from './openapi_schema.pure.lib.ts'

/**
 * Adapter for the admin login check. A UX gate only, not security: see
 * backend/app/admin_auth.py's docstring. The accepted password is then sent
 * as `X-Admin-Password` (ProfileAuth `admin`) on each admin call.
 */
export interface AdminApi {
  readonly login: (password: string) => Promise<'ok' | 'wrong-password'>
}

const PATH = '/api/admin/login'

export function bindAdminApi({ fetch, baseUrl }: { readonly fetch: HttpFetch; readonly baseUrl: string }): AdminApi {
  return {
    login: async (password) => {
      const body: components['schemas']['AdminLoginRequest'] = { password }
      const response = await fetch(`${baseUrl}${PATH}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (response.status === 401) return 'wrong-password'
      if (!response.ok) throw new Error(`POST ${PATH} failed with HTTP ${String(response.status)}`)
      return 'ok'
    },
  }
}
