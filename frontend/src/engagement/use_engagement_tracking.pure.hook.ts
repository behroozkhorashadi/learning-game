import { useEffect } from 'react'
import type { EngagementTracker } from './engagement_state.pure.lib.ts'

export function useEngagementTracking(tracker: EngagementTracker): void {
  useEffect(() => tracker.start(), [tracker])
}
