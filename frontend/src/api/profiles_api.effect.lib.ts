import type { HttpFetch } from './http.pure.lib.ts'
import { profileListSchema, type ProfileRecord } from './profiles_schema.pure.lib.ts'

/** Adapter for the profile endpoints. Grows a method per endpoint as more screens migrate. */
export interface ProfilesApi {
  readonly list: () => Promise<readonly ProfileRecord[]>
}

const PATH = '/api/profiles'

export function bindProfilesApi({ fetch, baseUrl }: { readonly fetch: HttpFetch; readonly baseUrl: string }): ProfilesApi {
  return {
    list: async () => {
      const response = await fetch(`${baseUrl}${PATH}`, { method: 'GET', headers: { Accept: 'application/json' } })
      if (!response.ok) throw new Error(`GET ${PATH} failed with HTTP ${String(response.status)}`)
      const result = profileListSchema.safeParse(await response.json())
      if (!result.success) throw new Error(`GET ${PATH} returned an unexpected body: ${result.error.message}`)
      return result.data
    },
  }
}
