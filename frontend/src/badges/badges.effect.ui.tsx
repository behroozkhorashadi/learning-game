import { useState, type ComponentType, type ReactElement } from 'react'
import type { ArtPieceRecord } from '@app/api/armory_schema.pure.lib.ts'
import type { BadgeRecord, ProfileStatsRecord } from '@app/api/badges_schema.pure.lib.ts'
import { usePrefersReducedMotion, type MotionPreference } from '@app/motion/use_prefers_reduced_motion.pure.hook.ts'
import { loaded } from '@app/query/query_state.pure.lib.ts'
import { useQuery } from '@app/query/use_query.pure.hook.ts'
import type { Timers } from '@app/timing/timing_state.pure.lib.ts'
import type { PaintState } from './badge_detail.pure.ui.tsx'
import { BadgesView, type BadgesData } from './badges.pure.ui.tsx'
import { usePolled } from './use_polled.pure.hook.ts'

/** Key this screen by `profileId`: it loads one profile's badges per mount. */
export interface BadgesProps {
  readonly profileId: number
  readonly kidName: string
  readonly onBack: () => void
}

export interface BadgesDeps {
  readonly loadBadges: (profileId: number) => Promise<readonly BadgeRecord[]>
  readonly loadStats: (profileId: number) => Promise<ProfileStatsRecord>
  /** Zombie Horde's art gallery, newest first. */
  readonly loadGallery: (profileId: number) => Promise<readonly ArtPieceRecord[]>
  /** Paints the profile's own art for an earned badge; resolves with the badge when done. */
  readonly paint: (profileId: number, key: string) => Promise<BadgeRecord>
  readonly motion: MotionPreference
  readonly now: () => Date
  readonly timers: Timers
  /** How often to look again while a badge's art is still painting. */
  readonly pollMs: number
}

/**
 * The badges & prizes screen: loads badges and stats together, then renders
 * the view. The art gallery loads on its own, so a gallery failure never
 * hides the badges. Painting a badge's art swaps in the badge it comes back
 * with, and while any badge's art is still painting (just earned) the badges
 * are looked at again until it lands.
 */
export function bindBadges({ loadBadges, loadStats, loadGallery, paint, motion, now, timers, pollMs }: BadgesDeps): ComponentType<BadgesProps> {
  function Badges({ profileId, kidName, onBack }: BadgesProps): ReactElement {
    const [load] = useState(() => async (): Promise<BadgesData> => {
      const [badges, stats] = await Promise.all([loadBadges(profileId), loadStats(profileId)])
      return { badges, stats }
    })
    const [loadArt] = useState(() => async (): Promise<readonly ArtPieceRecord[]> => loadGallery(profileId))
    const [reloadBadges] = useState(() => async (): Promise<readonly BadgeRecord[]> => loadBadges(profileId))
    const [mountedAt] = useState(now)
    const state = useQuery(load)
    const gallery = useQuery(loadArt)
    const reduced = usePrefersReducedMotion(motion)
    // Badges repainted here, by key: newer than what the query loaded.
    const [painted, setPainted] = useState<Readonly<Record<string, BadgeRecord>>>({})
    const [painting, setPainting] = useState<Readonly<Record<string, PaintState>>>({})

    const onPaint = (key: string): void => {
      setPainting((p) => ({ ...p, [key]: 'painting' }))
      paint(profileId, key).then(
        (badge) => {
          setPainted((p) => ({ ...p, [key]: badge }))
          setPainting((p) => ({ ...p, [key]: badge.art_status === 'ready' ? 'idle' : 'failed' }))
        },
        () => {
          setPainting((p) => ({ ...p, [key]: 'failed' }))
        },
      )
    }

    const merge = (badges: readonly BadgeRecord[], fresher: readonly BadgeRecord[] | null): readonly BadgeRecord[] => badges.map((b) => painted[b.key] ?? fresher?.find((f) => f.key === b.key) ?? b)
    const stillPainting = (fresher: readonly BadgeRecord[] | null): boolean => state.kind === 'loaded' && merge(state.data.badges, fresher).some((b) => b.art_status === 'pending')
    const refreshed = usePolled(reloadBadges, timers, pollMs, stillPainting)
    const shown = state.kind === 'loaded' ? loaded({ ...state.data, badges: merge(state.data.badges, refreshed) }) : state
    return <BadgesView state={shown} gallery={gallery} kidName={kidName} now={mountedAt} onBack={onBack} painting={painting} onPaint={onPaint} animate={!reduced} />
  }
  return Badges
}
