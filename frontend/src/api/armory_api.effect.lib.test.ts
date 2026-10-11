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
  catalog: [{ id: 'grenade_pack', kind: 'grenade', name: 'Grenade Pack', description: 'Three grenades.', price: 80, quantity: 3, requires: null }],
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
    await api.recordRound(3, { points: 90, grenades_used: 1 })
    await api.purchase(3, 'grenade_pack')
    expect(http.requests).toEqual([
      { url: '/api/profiles/3/armory/rounds', method: 'POST', body: { points: 90, grenades_used: 1 } },
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
})
