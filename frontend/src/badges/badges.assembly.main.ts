import type { ComponentType } from 'react'
import { bindArmoryApi } from '@app/api/armory_api.effect.lib.ts'
import { bindBadgesApi } from '@app/api/badges_api.effect.lib.ts'
import { assembleMotionPreference } from '@app/motion/motion_preference.assembly.main.ts'
import { assembleTimers } from '@app/timing/timing.assembly.main.ts'
import { bindBadges, type BadgesProps } from './badges.effect.ui.tsx'

/** Wires the badges & prizes screen to the real API (badges, stats, painting, Zombie Horde's art gallery), motion preference, and clock. Called once by the app shell. */
export function assembleBadges(): ComponentType<BadgesProps> {
  const http = { fetch: async (url: string, init: Parameters<typeof fetch>[1]) => fetch(url, init), baseUrl: '' }
  const api = bindBadgesApi(http)
  const armory = bindArmoryApi(http)
  return bindBadges({ loadBadges: api.badges, loadStats: api.stats, loadGallery: armory.gallery, paint: api.paint, motion: assembleMotionPreference(), now: () => new Date(), timers: assembleTimers(), pollMs: 5000 })
}
