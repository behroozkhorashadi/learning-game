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
})
