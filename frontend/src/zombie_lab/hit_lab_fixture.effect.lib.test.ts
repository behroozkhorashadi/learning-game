import { describe, expect, it } from 'vitest'
import type { HttpFetch, HttpResponse } from '@app/api/http.pure.lib.ts'
import { bindHitLabFixture } from './hit_lab_fixture.effect.lib.ts'

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

describe('bindHitLabFixture', () => {
  it('POSTs the labeled shots and reads back the counts', async () => {
    const { fetch, calls } = recordingFetch(ok({ added: 2, total: 40 }))
    expect(await bindHitLabFixture({ fetch }).append([])).toEqual({ added: 2, total: 40 })
    expect(calls).toEqual([{ url: '/__hit-lab/append', method: 'POST', body: JSON.stringify({ shots: [] }) }])
  })

  it('rejects a failure or an unexpected answer', async () => {
    await expect(bindHitLabFixture({ fetch: recordingFetch(failed(404)).fetch }).append([])).rejects.toThrow('HTTP 404')
    await expect(bindHitLabFixture({ fetch: recordingFetch(ok({ added: 'x' })).fetch }).append([])).rejects.toThrow('unexpected body')
  })
})
