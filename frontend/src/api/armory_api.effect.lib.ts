import { failureMessage, type HttpFetch } from './http.pure.lib.ts'
import { armoryStateSchema, type ArmoryStateRecord } from './armory_schema.pure.lib.ts'
import type { components } from './openapi_schema.pure.lib.ts'

/**
 * Adapter for Zombie Horde's armory (`/api/profiles/{id}/armory`, backend
 * `app/armory/`): the points balance, owned items, grenades left, and the
 * catalog with prices. Every call returns the whole state, so the screen
 * never has to merge a partial update.
 */

export interface ArmoryApi {
  readonly load: (profileId: number) => Promise<ArmoryStateRecord>
  /** Banks a finished round's points and spends the grenades it threw. */
  readonly recordRound: (profileId: number, round: components['schemas']['ArmoryRoundCreate']) => Promise<ArmoryStateRecord>
  /** Rejects with the server's reason (not enough points, already owned) when it can't be bought. */
  readonly purchase: (profileId: number, itemId: string) => Promise<ArmoryStateRecord>
}

const JSON_HEADERS = { Accept: 'application/json', 'Content-Type': 'application/json' }

function armoryPath(profileId: number): string {
  return `/api/profiles/${String(profileId)}/armory`
}

export function bindArmoryApi({ fetch, baseUrl }: { readonly fetch: HttpFetch; readonly baseUrl: string }): ArmoryApi {
  async function call(method: 'GET' | 'POST', path: string, body?: unknown): Promise<ArmoryStateRecord> {
    const response = await fetch(`${baseUrl}${path}`, body === undefined ? { method, headers: { Accept: 'application/json' } } : { method, headers: JSON_HEADERS, body: JSON.stringify(body) })
    if (!response.ok) throw new Error(await failureMessage(response, `${method} ${path}`))
    const result = armoryStateSchema.safeParse(await response.json())
    if (!result.success) throw new Error(`${method} ${path} returned an unexpected body: ${result.error.message}`)
    return result.data
  }

  return {
    load: async (profileId) => call('GET', armoryPath(profileId)),
    recordRound: async (profileId, round) => call('POST', `${armoryPath(profileId)}/rounds`, round),
    purchase: async (profileId, itemId) => {
      const body: components['schemas']['ArmoryPurchaseCreate'] = { item_id: itemId }
      return call('POST', `${armoryPath(profileId)}/purchases`, body)
    },
  }
}
