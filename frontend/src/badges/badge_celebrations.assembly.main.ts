import type { ComponentType } from 'react'
import { bindBadgesApi } from '@app/api/badges_api.effect.lib.ts'
import { assembleMotionPreference } from '@app/motion/motion_preference.assembly.main.ts'
import { assembleTimers } from '@app/timing/timing.assembly.main.ts'
import { bindBadgeCelebrations, type BadgeCelebrationsProps } from './badge_celebrations.effect.ui.tsx'

/** How often a player's screens look for new badges. */
const POLL_MS = 8000

/** Wires the new-badge celebrations to the real API, timers, and motion preference. Called once by the app shell. */
export function assembleBadgeCelebrations(): ComponentType<BadgeCelebrationsProps> {
  const api = bindBadgesApi({ fetch: async (url, init) => fetch(url, init), baseUrl: '' })
  return bindBadgeCelebrations({ loadNew: api.newBadges, markCelebrated: api.markCelebrated, timers: assembleTimers(), motion: assembleMotionPreference(), pollMs: POLL_MS })
}
