import { describe, expect, it } from 'vitest'
import type { HttpFetch, HttpResponse } from './http.pure.lib.ts'
import { bindTodosApi } from './todos_api.effect.lib.ts'

function respond(status: number, body: unknown): HttpResponse {
  return { ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) }
}

function fakeFetch(response: HttpResponse): HttpFetch & { readonly calls: Parameters<HttpFetch>[] } {
  const calls: Parameters<HttpFetch>[] = []
  const fetch: HttpFetch = (url, init) => {
    calls.push([url, init])
    return Promise.resolve(response)
  }
  return Object.assign(fetch, { calls })
}

const todo = { id: 'a', title: 'Feed the cat', done: false }

describe('bindTodosApi', () => {
  it('PUTs the list as JSON and returns the parsed body', async () => {
    const fetch = fakeFetch(respond(200, [todo]))
    const api = bindTodosApi({ fetch, baseUrl: 'http://api' })
    await expect(api.replaceAll([todo])).resolves.toEqual([todo])
    expect(fetch.calls[0]?.[0]).toBe('http://api/api/examples/todos')
    expect(fetch.calls[0]?.[1]).toMatchObject({ method: 'PUT', body: JSON.stringify([todo]) })
  })

  it('rejects a body that does not match the schema instead of passing it through', async () => {
    const api = bindTodosApi({ fetch: fakeFetch(respond(200, [{ id: 1, title: 'x' }])), baseUrl: '' })
    await expect(api.list()).rejects.toThrow('GET /api/examples/todos returned an unexpected body')
  })

  it('rejects a non-2xx response with the status', async () => {
    const api = bindTodosApi({ fetch: fakeFetch(respond(503, null)), baseUrl: '' })
    await expect(api.replaceAll([])).rejects.toThrow('PUT /api/examples/todos failed with HTTP 503')
  })
})
