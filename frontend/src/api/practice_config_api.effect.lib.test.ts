import { describe, expect, it } from 'vitest'
import type { HttpFetch, HttpResponse } from './http.pure.lib.ts'
import { bindPracticeConfigApi } from './practice_config_api.effect.lib.ts'

/** A fetch that answers every request with `response` and records what was asked. */
function recordingFetch(response: HttpResponse) {
  const calls: { readonly url: string; readonly method: string; readonly body: string | undefined }[] = []
  const fetch: HttpFetch = (url, init) => {
    calls.push({ url, method: init.method, body: init.body })
    return Promise.resolve(response)
  }
  return { fetch, calls }
}

const ok = (body: unknown, status = 200): HttpResponse => ({ ok: true, status, json: () => Promise.resolve(body) })
const failed = (status: number, body: unknown = null): HttpResponse => ({ ok: false, status, json: () => Promise.resolve(body) })

const CONFIG = { profile_id: 2, game_id: 'fact_fluency', operations: ['×'], focus_numbers: { '×': [7] }, difficulty: 8 }

describe('bindPracticeConfigApi', () => {
  it('reads the saved settings, or null when there are none', async () => {
    const { fetch, calls } = recordingFetch(ok({ ...CONFIG, id: 9, updated_at: '2026-10-01' }))
    expect(await bindPracticeConfigApi({ fetch, baseUrl: '' }).get(2, 'fact_fluency')).toEqual(CONFIG)
    expect(calls[0]?.url).toBe('/api/practice-config?profile_id=2&game_id=fact_fluency')
    expect(await bindPracticeConfigApi({ fetch: recordingFetch(failed(404)).fetch, baseUrl: '' }).get(2, 'fact_fluency')).toBeNull()
  })

  it('defaults missing focus numbers to none', async () => {
    const { focus_numbers: _focus, ...withoutFocus } = CONFIG
    const config = await bindPracticeConfigApi({ fetch: recordingFetch(ok(withoutFocus)).fetch, baseUrl: '' }).get(2, 'fact_fluency')
    expect(config?.focus_numbers).toEqual({})
  })

  it('PUTs a save and DELETEs a clear', async () => {
    const { fetch, calls } = recordingFetch(ok(CONFIG))
    const api = bindPracticeConfigApi({ fetch, baseUrl: '' })
    await api.save(CONFIG)
    await api.clear(2, 'fact_fluency')
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual(['PUT /api/practice-config', 'DELETE /api/practice-config?profile_id=2&game_id=fact_fluency'])
    expect(calls[0]?.body).toBe(JSON.stringify(CONFIG))
  })

  it("surfaces the server's reason for a rejected save", async () => {
    const api = bindPracticeConfigApi({ fetch: recordingFetch(failed(422, { detail: 'Pick at least one operation' })).fetch, baseUrl: '' })
    await expect(api.save(CONFIG)).rejects.toThrow('Pick at least one operation')
  })
})
