import { describe, expect, it } from 'vitest'
import { sampleReport, KID_SUMMARIES } from '@app/parents/parents_fixtures.test.lib.ts'
import type { HttpFetch, HttpResponse } from './http.pure.lib.ts'
import { bindParentsApi } from './parents_api.effect.lib.ts'

const ok = (body: unknown, status = 200): HttpResponse => ({ ok: true, status, json: () => Promise.resolve(body) })
const fail = (status: number, body: unknown = null): HttpResponse => ({ ok: false, status, json: () => Promise.resolve(body) })

interface Call {
  readonly url: string
  readonly method: string
  readonly headers: Readonly<Record<string, string>>
  readonly body: string | undefined
}

function recording(respond: (url: string, method: string) => HttpResponse): { readonly fetch: HttpFetch; readonly calls: Call[] } {
  const calls: Call[] = []
  const fetch: HttpFetch = (url, init) => {
    calls.push({ url, method: init.method, headers: init.headers, body: init.body })
    return Promise.resolve(respond(url, init.method))
  }
  return { fetch, calls }
}

const MOM = { id: 1, name: 'Mom', created_at: '2026-10-01T00:00:00' }

describe('bindParentsApi', () => {
  it('lists and creates parents', async () => {
    const { fetch, calls } = recording((_url, method) => (method === 'GET' ? ok([MOM]) : ok(MOM, 201)))
    const api = bindParentsApi({ fetch, baseUrl: 'http://api' })
    expect(await api.list()).toEqual([MOM])
    const created = await api.create({ name: 'Mom', password: 'secret' })
    expect(created).toEqual(MOM)
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual(['GET http://api/api/parents', 'POST http://api/api/parents'])
    expect(JSON.parse(calls[1]?.body ?? '{}')).toEqual({ name: 'Mom', password: 'secret' })
  })

  it("surfaces the server's message when a create is rejected", async () => {
    const { fetch } = recording(() => fail(422, { detail: 'password must be 4-128 characters' }))
    await expect(bindParentsApi({ fetch, baseUrl: '' }).create({ name: 'Mom', password: 'x' })).rejects.toThrow('password must be 4-128 characters')
  })

  it('unlock tells a wrong password apart from a failure', async () => {
    const statuses = [204, 401, 500]
    const { fetch } = recording(() => {
      const status = statuses.shift() ?? 500
      return status === 204 ? ok(null, 204) : fail(status)
    })
    const api = bindParentsApi({ fetch, baseUrl: '' })
    expect(await api.unlock(1, 'secret')).toBe('unlocked')
    expect(await api.unlock(1, 'nope')).toBe('wrong-password')
    await expect(api.unlock(1, 'x')).rejects.toThrow('HTTP 500')
  })

  it('sends the parent password on the overview and the report, and parses both', async () => {
    const report = sampleReport(7)
    const { fetch, calls } = recording((url) => (url.includes('/report') ? ok(report) : ok(KID_SUMMARIES)))
    const api = bindParentsApi({ fetch, baseUrl: '' })
    expect((await api.kids(1, 'pw')).map((k) => k.name)).toEqual(['Rami', 'Leila'])
    expect((await api.report(1, 2, 'pw', 7)).totals.problems).toBe(report.totals.problems)
    expect(calls.map((c) => [c.url, c.headers['X-Parent-Password']])).toEqual([
      ['/api/parents/1/kids', 'pw'],
      ['/api/parents/1/kids/2/report?days=7', 'pw'],
    ])
  })

  it('rejects a report that is not a report, and a 401 with its detail', async () => {
    await expect(bindParentsApi({ fetch: recording(() => ok({ nope: true })).fetch, baseUrl: '' }).report(1, 2, 'pw', 7)).rejects.toThrow('unexpected body')
    await expect(bindParentsApi({ fetch: recording(() => fail(401, { detail: 'wrong password for this parent' })).fetch, baseUrl: '' }).kids(1, 'x')).rejects.toThrow('wrong password for this parent')
  })

  it('deletes with the admin password', async () => {
    const { fetch, calls } = recording(() => ok(null, 204))
    await bindParentsApi({ fetch, baseUrl: '' }).remove(3, 'admin')
    expect(calls).toEqual([{ url: '/api/parents/3', method: 'DELETE', headers: { 'X-Admin-Password': 'admin' }, body: undefined }])
  })
})
