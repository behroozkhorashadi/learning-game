import { describe, expect, it } from 'vitest'
import type { HttpFetch, HttpResponse } from './http.pure.lib.ts'
import { bindProfilesApi } from './profiles_api.effect.lib.ts'

function fetchReturning(response: HttpResponse): HttpFetch & { readonly urls: string[] } {
  const urls: string[] = []
  const fetch: HttpFetch = (url) => {
    urls.push(url)
    return Promise.resolve(response)
  }
  return Object.assign(fetch, { urls })
}

const ok = (body: unknown): HttpResponse => ({ ok: true, status: 200, json: () => Promise.resolve(body) })

describe('bindProfilesApi', () => {
  it('GETs /api/profiles and parses the list', async () => {
    const fetch = fetchReturning(ok([{ id: 1, name: 'A', avatar: 'fox', birth_year: 2020, has_password: true }]))
    const profiles = await bindProfilesApi({ fetch, baseUrl: 'http://api' }).list()
    expect(fetch.urls).toEqual(['http://api/api/profiles'])
    expect(profiles[0]).toMatchObject({ id: 1, has_password: true, reading_support: false })
  })

  it('rejects a non-2xx response with the status', async () => {
    const fetch = fetchReturning({ ok: false, status: 500, json: () => Promise.resolve(null) })
    await expect(bindProfilesApi({ fetch, baseUrl: '' }).list()).rejects.toThrow('GET /api/profiles failed with HTTP 500')
  })

  it('rejects a body that is not a profile list', async () => {
    await expect(bindProfilesApi({ fetch: fetchReturning(ok({ profiles: [] })), baseUrl: '' }).list()).rejects.toThrow('unexpected body')
  })
})
