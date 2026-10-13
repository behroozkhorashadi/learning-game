import { useState, type ComponentType, type ReactElement } from 'react'
import type { ArtPieceRecord } from '@app/api/armory_schema.pure.lib.ts'
import type { BadgeRecord, ProfileStatsRecord } from '@app/api/badges_schema.pure.lib.ts'
import { useQuery } from '@app/query/use_query.pure.hook.ts'
import { BadgesView, type BadgesData } from './badges.pure.ui.tsx'

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
  readonly now: () => Date
}

/**
 * The badges & prizes screen: loads badges and stats together, then renders
 * the view. The art gallery loads on its own, so a gallery failure never
 * hides the badges.
 */
export function bindBadges({ loadBadges, loadStats, loadGallery, now }: BadgesDeps): ComponentType<BadgesProps> {
  function Badges({ profileId, kidName, onBack }: BadgesProps): ReactElement {
    const [load] = useState(() => async (): Promise<BadgesData> => {
      const [badges, stats] = await Promise.all([loadBadges(profileId), loadStats(profileId)])
      return { badges, stats }
    })
    const [loadArt] = useState(() => async (): Promise<readonly ArtPieceRecord[]> => loadGallery(profileId))
    const [mountedAt] = useState(now)
    const state = useQuery(load)
    const gallery = useQuery(loadArt)
    return <BadgesView state={state} gallery={gallery} kidName={kidName} now={mountedAt} onBack={onBack} />
  }
  return Badges
}
