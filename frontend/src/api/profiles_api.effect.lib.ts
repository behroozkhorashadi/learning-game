import type { z } from 'zod'
import { failureMessage, type HttpFetch, type HttpResponse } from './http.pure.lib.ts'
import type { components } from './openapi_schema.pure.lib.ts'
import {
  photoRemixResponseSchema,
  profileListSchema,
  profileSchema,
  savedPhotoListSchema,
  type ProfileAuth,
  type ProfileRecord,
} from './profiles_schema.pure.lib.ts'

type SavedPhoto = components['schemas']['ProfilePhotoRead']

/** Adapter for the profile endpoints. Grows a method per endpoint as more screens migrate. */
export interface ProfilesApi {
  readonly list: () => Promise<readonly ProfileRecord[]>
  readonly create: (body: components['schemas']['ProfileCreate']) => Promise<ProfileRecord>
  readonly update: (id: number, body: components['schemas']['ProfileUpdate'], auth: ProfileAuth) => Promise<ProfileRecord>
  readonly remove: (id: number, auth: ProfileAuth) => Promise<void>
  /** Checks a protected profile's password (the admin password also unlocks it). */
  readonly unlock: (id: number, password: string) => Promise<'unlocked' | 'wrong-password'>
  readonly listPhotos: (id: number, auth: ProfileAuth) => Promise<readonly SavedPhoto[]>
  readonly deletePhoto: (id: number, photoId: number, auth: ProfileAuth) => Promise<void>
  /** A remix preview of a photo; nothing is saved. Resolves to the new picture's data URL. */
  readonly remixPhoto: (request: components['schemas']['ProfilePhotoRemixRequest']) => Promise<string>
}

const PATH = '/api/profiles'
const REMIX_PATH = '/api/profile-photos/remix'
const JSON_HEADERS = { Accept: 'application/json', 'Content-Type': 'application/json' }

export function authHeaders(auth: ProfileAuth): Readonly<Record<string, string>> {
  switch (auth.kind) {
    case 'none':
      return {}
    case 'profile':
      return { 'X-Profile-Password': auth.password }
    case 'admin':
      return { 'X-Admin-Password': auth.password }
  }
}

export function bindProfilesApi({ fetch, baseUrl }: { readonly fetch: HttpFetch; readonly baseUrl: string }): ProfilesApi {
  async function parsed<T>(response: HttpResponse, schema: z.ZodType<T>, what: string): Promise<T> {
    const result = schema.safeParse(await response.json())
    if (!result.success) throw new Error(`${what} returned an unexpected body: ${result.error.message}`)
    return result.data
  }

  return {
    list: async () => {
      const response = await fetch(`${baseUrl}${PATH}`, { method: 'GET', headers: { Accept: 'application/json' } })
      if (!response.ok) throw new Error(`GET ${PATH} failed with HTTP ${String(response.status)}`)
      return parsed(response, profileListSchema, `GET ${PATH}`)
    },
    create: async (body) => {
      const response = await fetch(`${baseUrl}${PATH}`, { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(body) })
      if (!response.ok) throw new Error(await failureMessage(response, `POST ${PATH}`))
      return parsed(response, profileSchema, `POST ${PATH}`)
    },
    update: async (id, body, auth) => {
      const path = `${PATH}/${String(id)}`
      const response = await fetch(`${baseUrl}${path}`, { method: 'PATCH', headers: { ...JSON_HEADERS, ...authHeaders(auth) }, body: JSON.stringify(body) })
      if (!response.ok) throw new Error(await failureMessage(response, `PATCH ${path}`))
      return parsed(response, profileSchema, `PATCH ${path}`)
    },
    remove: async (id, auth) => {
      const path = `${PATH}/${String(id)}`
      const response = await fetch(`${baseUrl}${path}`, { method: 'DELETE', headers: authHeaders(auth) })
      if (!response.ok) throw new Error(await failureMessage(response, `DELETE ${path}`))
    },
    unlock: async (id, password) => {
      const path = `${PATH}/${String(id)}/unlock`
      const body: components['schemas']['ProfileUnlockRequest'] = { password }
      const response = await fetch(`${baseUrl}${path}`, { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(body) })
      if (response.status === 401) return 'wrong-password'
      if (!response.ok) throw new Error(`POST ${path} failed with HTTP ${String(response.status)}`)
      return 'unlocked'
    },
    listPhotos: async (id, auth) => {
      const path = `${PATH}/${String(id)}/photos`
      const response = await fetch(`${baseUrl}${path}`, { method: 'GET', headers: { Accept: 'application/json', ...authHeaders(auth) } })
      if (!response.ok) throw new Error(`GET ${path} failed with HTTP ${String(response.status)}`)
      return parsed(response, savedPhotoListSchema, `GET ${path}`)
    },
    deletePhoto: async (id, photoId, auth) => {
      const path = `${PATH}/${String(id)}/photos/${String(photoId)}`
      const response = await fetch(`${baseUrl}${path}`, { method: 'DELETE', headers: authHeaders(auth) })
      if (!response.ok) throw new Error(await failureMessage(response, `DELETE ${path}`))
    },
    remixPhoto: async (request) => {
      const response = await fetch(`${baseUrl}${REMIX_PATH}`, { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(request) })
      if (!response.ok) throw new Error(await failureMessage(response, `POST ${REMIX_PATH}`))
      return (await parsed(response, photoRemixResponseSchema, `POST ${REMIX_PATH}`)).image_data_url
    },
  }
}
