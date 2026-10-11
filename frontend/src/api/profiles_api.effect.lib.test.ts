import { describe, expect, it } from 'vitest'
import type { HttpFetch, HttpResponse } from './http.pure.lib.ts'
import { authHeaders, bindProfilesApi } from './profiles_api.effect.lib.ts'

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

  it('POSTs a new profile and parses the created row', async () => {
    const calls: { url: string; body: string | undefined }[] = []
    const fetch: HttpFetch = (url, init) => {
      calls.push({ url, body: init.body })
      return Promise.resolve(ok({ id: 4, name: 'Ada', avatar: 'cat', birth_year: 2017 }))
    }
    const body = { name: 'Ada', avatar: 'cat', birth_year: 2017, reading_support: false, new_photos: [], password: null }
    const created = await bindProfilesApi({ fetch, baseUrl: '' }).create(body)
    expect(calls).toEqual([{ url: '/api/profiles', body: JSON.stringify(body) }])
    expect(created).toMatchObject({ id: 4, has_password: false })
  })

  it("rejects a failed create with the server's detail, or the status when there is none", async () => {
    const api = (response: HttpResponse) => bindProfilesApi({ fetch: fetchReturning(response), baseUrl: '' })
    const body = { name: '', avatar: 'cat', birth_year: 2017, reading_support: false, new_photos: [] }
    await expect(api({ ok: false, status: 422, json: () => Promise.resolve({ detail: 'name must not be blank' }) }).create(body)).rejects.toThrow(/^name must not be blank$/)
    await expect(api({ ok: false, status: 502, json: () => Promise.reject(new Error('not json')) }).create(body)).rejects.toThrow('POST /api/profiles failed with HTTP 502')
  })

  it('POSTs a remix request and returns the new picture', async () => {
    const fetch = fetchReturning(ok({ image_data_url: 'data:image/jpeg;base64,R' }))
    const picture = await bindProfilesApi({ fetch, baseUrl: '' }).remixPhoto({ image_data_url: 'data:o', style: 'wizard', idea: null })
    expect(fetch.urls).toEqual(['/api/profile-photos/remix'])
    expect(picture).toBe('data:image/jpeg;base64,R')
  })

  it('rejects a remix response without a picture', async () => {
    await expect(bindProfilesApi({ fetch: fetchReturning(ok({})), baseUrl: '' }).remixPhoto({ image_data_url: 'data:o' })).rejects.toThrow('unexpected body')
  })

  it('sends each kind of auth as the header the backend checks', () => {
    expect(authHeaders({ kind: 'none' })).toEqual({})
    expect(authHeaders({ kind: 'profile', password: 'p' })).toEqual({ 'X-Profile-Password': 'p' })
    expect(authHeaders({ kind: 'admin', password: 'a' })).toEqual({ 'X-Admin-Password': 'a' })
  })

  it('PATCHes, DELETEs, and lists photos with the auth header', async () => {
    const calls: { url: string; method: string; headers: Readonly<Record<string, string>> }[] = []
    const fetch: HttpFetch = (url, init) => {
      calls.push({ url, method: init.method, headers: init.headers })
      if (url.endsWith('/photos')) return Promise.resolve(ok([{ id: 1, url: '/static/a.jpg', label: 'Photo', created_at: '2026-10-01T00:00:00' }]))
      return Promise.resolve(init.method === 'PATCH' ? ok({ id: 4, name: 'B', avatar: 'owl', birth_year: 2019 }) : { ok: true, status: 204, json: () => Promise.resolve(null) })
    }
    const api = bindProfilesApi({ fetch, baseUrl: '' })
    const auth = { kind: 'admin', password: 's' } as const
    expect((await api.update(4, { name: 'B', new_photos: [], remove_password: false }, auth)).name).toBe('B')
    await api.remove(4, auth)
    expect(await api.listPhotos(4, auth)).toHaveLength(1)
    await api.deletePhoto(4, 1, auth)
    expect(calls.map((c) => `${c.method} ${c.url} ${c.headers['X-Admin-Password'] ?? ''}`)).toEqual([
      'PATCH /api/profiles/4 s',
      'DELETE /api/profiles/4 s',
      'GET /api/profiles/4/photos s',
      'DELETE /api/profiles/4/photos/1 s',
    ])
  })

  it('maps an unlock 401 to a wrong password and 204 to unlocked', async () => {
    const statusFetch = (code: number): HttpFetch => () => Promise.resolve({ ok: code < 300, status: code, json: () => Promise.resolve(null) })
    expect(await bindProfilesApi({ fetch: statusFetch(204), baseUrl: '' }).unlock(3, 'x')).toBe('unlocked')
    expect(await bindProfilesApi({ fetch: statusFetch(401), baseUrl: '' }).unlock(3, 'x')).toBe('wrong-password')
    await expect(bindProfilesApi({ fetch: statusFetch(500), baseUrl: '' }).unlock(3, 'x')).rejects.toThrow('HTTP 500')
  })
})
