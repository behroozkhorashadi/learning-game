import { bindPracticeApi } from '@app/api/practice_api.effect.lib.ts'
import { assembleRandomId } from '@app/ids/random_id.assembly.main.ts'
import type { PracticeDeps } from './practice_state.pure.lib.ts'

/** The real practice loop for one game: its API, a random session id, `performance.now`, and `setTimeout`. */
export function assemblePracticeDeps<P>(gameId: string, parsePayload: (payload: Readonly<Record<string, unknown>>) => P): PracticeDeps<P> {
  const api = bindPracticeApi({ fetch: async (url, init) => fetch(url, init), baseUrl: '' })
  return {
    loadItem: async (profileId, sessionId) => {
      const item = await api.nextItem({ profileId, gameId, sessionId })
      return { itemId: item.item_id, gameId: item.game_id, payload: parsePayload(item.payload) }
    },
    recordAttempt: api.recordAttempt,
    rate: (profileId, value) => api.rate({ profile_id: profileId, game_id: gameId, scale: 'stars_1_5', value }),
    verify: (attemptId, correct) => api.verify({ attempt_id: attemptId, correct, verified_by: 'parent' }),
    createId: assembleRandomId(),
    now: () => performance.now(),
    wait: (ms) =>
      new Promise((resolve) => {
        setTimeout(resolve, ms)
      }),
  }
}
