import { describe, expect, it } from 'vitest'
import { bindAdminApi } from './admin_api.effect.lib.ts'
import type { HttpFetch } from './http.pure.lib.ts'

const status = (code: number): HttpFetch => () => Promise.resolve({ ok: code < 300, status: code, json: () => Promise.resolve(null) })

describe('bindAdminApi', () => {
  it('maps 204 to ok and 401 to a wrong password', async () => {
    expect(await bindAdminApi({ fetch: status(204), baseUrl: '' }).login('pw')).toBe('ok')
    expect(await bindAdminApi({ fetch: status(401), baseUrl: '' }).login('pw')).toBe('wrong-password')
  })

  it('rejects any other failure with the status', async () => {
    await expect(bindAdminApi({ fetch: status(503), baseUrl: '' }).login('pw')).rejects.toThrow('POST /api/admin/login failed with HTTP 503')
  })
})
