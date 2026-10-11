import { describe, expect, it, vi } from 'vitest'
import { assembleTimers } from './timing.assembly.main.ts'
import { waitFor } from './timing_state.pure.lib.ts'

describe('assembleTimers', () => {
  it('fires, repeats, and cancels', async () => {
    const timers = assembleTimers()
    const cancelled = vi.fn()
    timers.after(1, cancelled)()
    let ticks = 0
    const stop = timers.every(1, () => {
      ticks += 1
    })
    await waitFor(timers, 20)
    stop()
    expect(cancelled).not.toHaveBeenCalled()
    expect(ticks).toBeGreaterThan(0)
  })
})
