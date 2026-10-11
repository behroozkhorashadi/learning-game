import { useState, type ComponentType, type ReactElement } from 'react'
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
  readonly now: () => Date
}

/** The badges screen: loads badges and stats together, then renders the view. */
export function bindBadges({ loadBadges, loadStats, now }: BadgesDeps): ComponentType<BadgesProps> {
  function Badges({ profileId, kidName, onBack }: BadgesProps): ReactElement {
    const [load] = useState(() => async (): Promise<BadgesData> => {
      const [badges, stats] = await Promise.all([loadBadges(profileId), loadStats(profileId)])
      return { badges, stats }
    })
    const [mountedAt] = useState(now)
    const state = useQuery(load)
    return <BadgesView state={state} kidName={kidName} now={mountedAt} onBack={onBack} />
  }
  return Badges
}
