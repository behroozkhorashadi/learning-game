import type { HttpFetch } from '@app/api/http.pure.lib.ts'
import { appendResultSchema, type AppendResult, type LabShot } from './hit_lab_state.pure.lib.ts'

/** The dev server's fixture endpoint (vite.config.ts, dev builds only): merges labeled shots into e2e/fixtures/zombie-hit-lab-shots.json. */

const PATH = '/__hit-lab/append'

export interface HitLabFixture {
  readonly append: (shots: readonly LabShot[]) => Promise<AppendResult>
}

export function bindHitLabFixture({ fetch }: { readonly fetch: HttpFetch }): HitLabFixture {
  return {
    append: async (shots) => {
      const response = await fetch(PATH, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ shots }) })
      if (!response.ok) throw new Error(`POST ${PATH} failed with HTTP ${String(response.status)}`)
      const result = appendResultSchema.safeParse(await response.json())
      if (!result.success) throw new Error(`POST ${PATH} returned an unexpected body: ${result.error.message}`)
      return result.data
    },
  }
}
