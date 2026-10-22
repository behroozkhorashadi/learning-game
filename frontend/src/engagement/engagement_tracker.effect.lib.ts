import type { EngagementLocation, EngagementSpan, EngagementTracker } from './engagement_state.pure.lib.ts'

const TICK_MS = 5_000
const IDLE_AFTER_MS = 30_000
const FLUSH_AFTER_MS = 30_000

export interface EngagementTrackerDeps {
  readonly now: () => number
  readonly isVisible: () => boolean
  readonly currentLocation: () => EngagementLocation | null
  readonly subscribeActivity: (onActivity: () => void) => () => void
  readonly every: (ms: number, run: () => void) => () => void
  readonly record: (spans: readonly EngagementSpan[]) => Promise<void>
}

export function bindEngagementTracker({ now, isVisible, currentLocation, subscribeActivity, every, record }: EngagementTrackerDeps): EngagementTracker {
  return {
    start: () => {
      let lastTick = now()
      let lastActivity: number | null = null
      let sinceFlush = 0
      let pending = new Map<string, EngagementSpan>()
      let stopped = false

      const activity = (): void => {
        lastActivity = now()
      }

      const flush = (): void => {
        if (pending.size === 0) return
        const sending = pending
        pending = new Map()
        void record([...sending.values()]).catch(() => {
          if (stopped) return
          for (const span of sending.values()) {
            const key = `${span.profile_id ?? 'anonymous'}:${span.area}`
            const previous = pending.get(key)
            pending.set(key, { ...span, active_ms: span.active_ms + (previous?.active_ms ?? 0) })
          }
        })
      }

      const tick = (): void => {
        const at = now()
        const elapsed = Math.max(0, Math.min(at - lastTick, TICK_MS))
        lastTick = at
        sinceFlush += elapsed
        if (isVisible() && lastActivity !== null && at - lastActivity <= IDLE_AFTER_MS) {
          const location = currentLocation()
          if (location !== null && elapsed > 0) {
            const key = `${location.profileId ?? 'anonymous'}:${location.area}`
            const previous = pending.get(key)
            pending.set(key, {
              area: location.area,
              profile_id: location.profileId,
              active_ms: Math.round(elapsed) + (previous?.active_ms ?? 0),
            })
          }
        }
        if (sinceFlush >= FLUSH_AFTER_MS) {
          sinceFlush = 0
          flush()
        }
      }

      const unsubscribe = subscribeActivity(activity)
      const cancelTick = every(TICK_MS, tick)
      return () => {
        stopped = true
        cancelTick()
        unsubscribe()
        tick()
        flush()
      }
    },
  }
}
