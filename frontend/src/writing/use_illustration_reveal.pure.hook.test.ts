import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { manualTimers } from '@app/timing/manual_timers.test.lib.ts'
import { HERO_MIN_MS, useIllustrationReveal } from './use_illustration_reveal.pure.hook.ts'
import { fakeIllustrator } from './writing_fixtures.test.lib.ts'

describe('useIllustrationReveal', () => {
  it('waits for both the request and the minimum dwell', async () => {
    const timers = manualTimers()
    const { result } = renderHook(() => useIllustrationReveal({ generateIllustration: fakeIllustrator().generateIllustration, timers }, 'p1', 'x'))
    await act(async () => {
      timers.advance(HERO_MIN_MS - 1)
      await Promise.resolve()
    })
    expect(result.current.phase).toBe('painting')
    await act(async () => {
      timers.advance(1)
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(result.current.phase).toBe('hero')
    expect(result.current.heroImageUrl).toBe('/static/illustrations/1.png')
  })

  it('drops a hero that arrives after unmount', async () => {
    const timers = manualTimers()
    const { result, unmount } = renderHook(() => useIllustrationReveal({ generateIllustration: fakeIllustrator().generateIllustration, timers }, 'p1', 'x'))
    unmount()
    await act(async () => {
      timers.advance(HERO_MIN_MS)
      await Promise.resolve()
    })
    expect(result.current.phase).toBe('painting')
  })
})
