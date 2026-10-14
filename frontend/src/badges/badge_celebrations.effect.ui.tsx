import { useState, type ComponentType, type ReactElement } from 'react'
import type { BadgeRecord } from '@app/api/badges_schema.pure.lib.ts'
import { usePrefersReducedMotion, type MotionPreference } from '@app/motion/use_prefers_reduced_motion.pure.hook.ts'
import type { Timers } from '@app/timing/timing_state.pure.lib.ts'
import { BadgeCelebration, BadgeToast } from './badge_celebration.pure.ui.tsx'
import { usePolled } from './use_polled.pure.hook.ts'

/**
 * Over every screen of a player: `party` (home, badges) throws the full
 * celebration for each new badge, one at a time, and marks it seen; `toast`
 * (in a game) only slides a note in, so play isn't interrupted, and leaves the
 * party for when the kid gets back home. Key it by `profileId`.
 */
export interface BadgeCelebrationsProps {
  readonly profileId: number
  readonly mode: 'party' | 'toast'
}

export interface BadgeCelebrationsDeps {
  readonly loadNew: (profileId: number) => Promise<readonly BadgeRecord[]>
  readonly markCelebrated: (profileId: number, key: string) => Promise<void>
  readonly timers: Timers
  readonly motion: MotionPreference
  /** How often to look for new badges (and new art for the one on show). */
  readonly pollMs: number
}

const NONE: readonly BadgeRecord[] = []

export function bindBadgeCelebrations({ loadNew, markCelebrated, timers, motion, pollMs }: BadgeCelebrationsDeps): ComponentType<BadgeCelebrationsProps> {
  function BadgeCelebrations({ profileId, mode }: BadgeCelebrationsProps): ReactElement | null {
    const [load] = useState(() => async (): Promise<readonly BadgeRecord[]> => loadNew(profileId))
    const fresh = usePolled(load, timers, pollMs) ?? NONE
    const [celebrated, setCelebrated] = useState<ReadonlySet<string>>(() => new Set())
    const [toasted, setToasted] = useState<ReadonlySet<string>>(() => new Set())
    const reduced = usePrefersReducedMotion(motion)
    const waiting = fresh.filter((b) => !celebrated.has(b.key))

    if (mode === 'toast') {
      const next = waiting.find((b) => !toasted.has(b.key))
      if (next === undefined) return null
      return (
        <div
          onAnimationEnd={() => {
            setToasted((keys) => new Set([...keys, next.key]))
          }}
        >
          <BadgeToast key={next.key} badge={next} />
        </div>
      )
    }

    const [first] = waiting
    if (first === undefined) return null
    const done = (): void => {
      setCelebrated((keys) => new Set([...keys, first.key]))
      // A failed mark only means the party comes back next visit.
      markCelebrated(profileId, first.key).catch(() => undefined)
    }
    return <BadgeCelebration key={first.key} badge={first} remaining={waiting.length - 1} animate={!reduced} onDone={done} />
  }
  return BadgeCelebrations
}
