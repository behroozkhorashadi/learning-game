import { failureMessage, type HttpFetch } from './http.pure.lib.ts'
import type { components } from './openapi_schema.pure.lib.ts'
import { photoRemixResponseSchema, profileListSchema, profileSchema, type ProfileRecord } from './profiles_schema.pure.lib.ts'

/** Adapter for the profile endpoints. Grows a method per endpoint as more screens migrate. */
export interface ProfilesApi {
  readonly list: () => Promise<readonly ProfileRecord[]>
  readonly create: (body: components['schemas']['ProfileCreate']) => Promise<ProfileRecord>
  /** A remix preview of a photo; nothing is saved. Resolves to the new picture's data URL. */
  readonly remixPhoto: (request: components['schemas']['ProfilePhotoRemixRequest']) => Promise<string>
}

const PATH = '/api/profiles'
const REMIX_PATH = '/api/profile-photos/remix'
const JSON_HEADERS = { Accept: 'application/json', 'Content-Type': 'application/json' }

export function bindProfilesApi({ fetch, baseUrl }: { readonly fetch: HttpFetch; readonly baseUrl: string }): ProfilesApi {
  return {
    list: async () => {
      const response = await fetch(`${baseUrl}${PATH}`, { method: 'GET', headers: { Accept: 'application/json' } })
      if (!response.ok) throw new Error(`GET ${PATH} failed with HTTP ${String(response.status)}`)
      const result = profileListSchema.safeParse(await response.json())
      if (!result.success) throw new Error(`GET ${PATH} returned an unexpected body: ${result.error.message}`)
      return result.data
    },
    create: async (body) => {
      const response = await fetch(`${baseUrl}${PATH}`, { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(body) })
      if (!response.ok) throw new Error(await failureMessage(response, `POST ${PATH}`))
      const result = profileSchema.safeParse(await response.json())
      if (!result.success) throw new Error(`POST ${PATH} returned an unexpected body: ${result.error.message}`)
      return result.data
    },
    remixPhoto: async (request) => {
      const response = await fetch(`${baseUrl}${REMIX_PATH}`, { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(request) })
      if (!response.ok) throw new Error(await failureMessage(response, `POST ${REMIX_PATH}`))
      const result = photoRemixResponseSchema.safeParse(await response.json())
      if (!result.success) throw new Error(`POST ${REMIX_PATH} returned an unexpected body: ${result.error.message}`)
      return result.data.image_data_url
    },
  }
}
