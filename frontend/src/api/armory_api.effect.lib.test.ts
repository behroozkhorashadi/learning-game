import { describe, expect, it } from 'vitest'
import { bindArmoryApi } from './armory_api.effect.lib.ts'
import type { HttpFetch, HttpResponse } from './http.pure.lib.ts'

const STATE = {
  profile_id: 3,
  balance: 120,
  earned: 200,
  spent: 80,
  owned: ['starter_blaster', 'standard_rounds'],
  grenades: 4,
  ammo: { armor_piercing: 0 },
  best_survived_ms: 0,
  catalog: [{ id: 'grenade_pack', kind: 'grenade', name: 'Grenade Pack', description: 'Three grenades.', price: 80, quantity: 3, consumable: true, requires: null }],
}

function fakeHttp(respond: (url: string, method: string, body: unknown) => HttpResponse) {
  const requests: { readonly url: string; readonly method: string; readonly body: unknown }[] = []
  const fetch: HttpFetch = (url, init) => {
    const body: unknown = init.body === undefined ? undefined : JSON.parse(init.body)
    requests.push({ url, method: init.method, body })
    return Promise.resolve(respond(url, init.method, body))
  }
  return { fetch, requests }
}

const ok = (body: unknown): HttpResponse => ({ ok: true, status: 200, json: () => Promise.resolve(body) })

describe('bindArmoryApi', () => {
  it('loads the state for a profile', async () => {
    const http = fakeHttp(() => ok(STATE))
    const api = bindArmoryApi({ fetch: http.fetch, baseUrl: 'http://x' })
    await expect(api.load(3)).resolves.toEqual(STATE)
    expect(http.requests).toEqual([{ url: 'http://x/api/profiles/3/armory', method: 'GET', body: undefined }])
  })

  it('posts a round and a purchase with their bodies', async () => {
    const http = fakeHttp(() => ok(STATE))
    const api = bindArmoryApi({ fetch: http.fetch, baseUrl: '' })
    await api.recordRound(3, { points: 90, grenades_used: 1, survived_ms: 61_000 })
    await api.purchase(3, 'grenade_pack')
    expect(http.requests).toEqual([
      { url: '/api/profiles/3/armory/rounds', method: 'POST', body: { points: 90, grenades_used: 1, survived_ms: 61_000 } },
      { url: '/api/profiles/3/armory/purchases', method: 'POST', body: { item_id: 'grenade_pack' } },
    ])
  })

  it("rejects with the server's reason when a purchase is refused", async () => {
    const http = fakeHttp(() => ({ ok: false, status: 409, json: () => Promise.resolve({ detail: "'rapid_blaster' costs 250 points; the balance is 10" }) }))
    const api = bindArmoryApi({ fetch: http.fetch, baseUrl: '' })
    await expect(api.purchase(3, 'rapid_blaster')).rejects.toThrow("'rapid_blaster' costs 250 points; the balance is 10")
  })

  it('rejects a body that is not an armory state', async () => {
    const http = fakeHttp(() => ok({ balance: 'lots' }))
    const api = bindArmoryApi({ fetch: http.fetch, baseUrl: '' })
    await expect(api.load(3)).rejects.toThrow('GET /api/profiles/3/armory returned an unexpected body')
  })

  it('lists the gallery and makes art', async () => {
    const piece = { id: 'a1', profile_id: 3, image_url: '/static/armory-art/a1.jpg', style: 'pixel_hero', idea: '', created_at: '2026-10-11T12:00:00Z' }
    const http = fakeHttp((_url, method) => (method === 'GET' ? ok([piece]) : ok({ piece, armory: STATE })))
    const api = bindArmoryApi({ fetch: http.fetch, baseUrl: '' })
    await expect(api.gallery(3)).resolves.toEqual([piece])
    await expect(api.createArt(3, { image_data_url: 'data:image/png;base64,aGk=', style: 'pixel_hero', idea: '' })).resolves.toEqual({ piece, armory: STATE })
    expect(http.requests.map((r) => `${r.method} ${r.url}`)).toEqual(['GET /api/profiles/3/armory/art', 'POST /api/profiles/3/armory/art'])
  })

  it("rejects with the server's reason when art can't be made", async () => {
    const http = fakeHttp(() => ({ ok: false, status: 503, json: () => Promise.resolve({ detail: "the art studio can't make art right now; no points were spent" }) }))
    const api = bindArmoryApi({ fetch: http.fetch, baseUrl: '' })
    await expect(api.createArt(3, { image_data_url: 'x', style: 'pixel_hero', idea: '' })).rejects.toThrow('no points were spent')
  })
})
