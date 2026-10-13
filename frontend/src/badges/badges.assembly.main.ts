import type { ComponentType } from 'react'
import { bindArmoryApi } from '@app/api/armory_api.effect.lib.ts'
import { bindBadgesApi } from '@app/api/badges_api.effect.lib.ts'
import { bindBadges, type BadgesProps } from './badges.effect.ui.tsx'

/** Wires the badges & prizes screen to the real API (badges, stats, Zombie Horde's art gallery) and clock. Called once by the app shell. */
export function assembleBadges(): ComponentType<BadgesProps> {
  const http = { fetch: async (url: string, init: Parameters<typeof fetch>[1]) => fetch(url, init), baseUrl: '' }
  const api = bindBadgesApi(http)
  const armory = bindArmoryApi(http)
  return bindBadges({ loadBadges: api.badges, loadStats: api.stats, loadGallery: armory.gallery, now: () => new Date() })
}
