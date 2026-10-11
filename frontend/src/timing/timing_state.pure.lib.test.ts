import { describe, expect, it, vi } from 'vitest'
import { manualTimers } from './manual_timers.test.lib.ts'
import { waitFor } from './timing_state.pure.lib.ts'

describe('waitFor', () => {
  it('resolves when the time passes', async () => {
    const timers = manualTimers()
    const done = vi.fn()
    const waiting = waitFor(timers, 500).then(done)
    timers.advance(499)
    await Promise.resolve()
    expect(done).not.toHaveBeenCalled()
    timers.advance(1)
    await waiting
    expect(done).toHaveBeenCalled()
  })
})
