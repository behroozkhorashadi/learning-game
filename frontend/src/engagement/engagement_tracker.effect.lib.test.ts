import { describe, expect, it } from 'vitest'
import { bindEngagementTracker } from './engagement_tracker.effect.lib.ts'
import type { EngagementLocation, EngagementSpan } from './engagement_state.pure.lib.ts'

describe('engagement tracker', () => {
  it('counts visible time only after activity, pauses when idle or hidden, and separates areas', async () => {
    let now = 0
    let visible = true
    let location: EngagementLocation = { area: 'home', profileId: 7 }
    let activity = (): void => undefined
    let tick = (): void => undefined
    const sent: EngagementSpan[][] = []
    const tracker = bindEngagementTracker({
      now: () => now,
      isVisible: () => visible,
      currentLocation: () => location,
      subscribeActivity: (run) => {
        activity = run
        return () => undefined
      },
      every: (_ms, run) => {
        tick = run
        return () => undefined
      },
      record: (spans) => {
        sent.push([...spans])
        return Promise.resolve()
      },
    })
    const stop = tracker.start()

    now = 5000
    tick()
    activity()
    for (let index = 0; index < 3; index += 1) {
      now += 5000
      tick()
    }
    location = { area: 'game:zombie_horde', profileId: 7 }
    visible = false
    now += 5000
    tick()
    visible = true
    now = 40_001
    tick()
    activity()
    now += 5000
    tick()
    stop()
    await Promise.resolve()

    expect(sent.flat()).toEqual([
      { area: 'home', profile_id: 7, active_ms: 15_000 },
      { area: 'game:zombie_horde', profile_id: 7, active_ms: 5000 },
    ])
  })
})
