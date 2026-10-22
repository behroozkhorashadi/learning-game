import { describe, expect, it, vi } from 'vitest'
import type { HttpFetch } from './http.pure.lib.ts'
import { bindEngagementApi } from './engagement_api.effect.lib.ts'

describe('engagement api', () => {
  it('sends aggregate spans with unload-safe fetching', async () => {
    const fetch = vi.fn<HttpFetch>(() => Promise.resolve({ ok: true, status: 204, json: () => Promise.resolve(null) }))
    const api = bindEngagementApi({ fetch, baseUrl: '' })

    await api.record([{ area: 'home', active_ms: 5000, profile_id: null }])

    expect(fetch).toHaveBeenCalledWith('/api/engagement', expect.objectContaining({ method: 'POST', keepalive: true }))
  })

  it('parses the admin summary', async () => {
    const fetch: HttpFetch = () => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([{ area: 'home', active_ms: 5000 }]) })
    await expect(bindEngagementApi({ fetch, baseUrl: '' }).summary('secret')).resolves.toEqual([{ area: 'home', active_ms: 5000 }])
  })
})
