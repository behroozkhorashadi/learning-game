import type { ComponentType } from 'react'
import { bindBadgesApi } from '@app/api/badges_api.effect.lib.ts'
import { bindBadges, type BadgesProps } from './badges.effect.ui.tsx'

/** Wires the badges screen to the real API and clock. Called once by the app shell. */
export function assembleBadges(): ComponentType<BadgesProps> {
  const api = bindBadgesApi({ fetch: async (url, init) => fetch(url, init), baseUrl: '' })
  return bindBadges({ loadBadges: api.badges, loadStats: api.stats, now: () => new Date() })
}
