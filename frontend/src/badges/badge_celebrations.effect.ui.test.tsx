import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { BadgeRecord } from '@app/api/badges_schema.pure.lib.ts'
import type { MotionPreference } from '@app/motion/use_prefers_reduced_motion.pure.hook.ts'
import { manualTimers, type ManualTimers } from '@app/timing/manual_timers.test.lib.ts'
import { bindBadgeCelebrations } from './badge_celebrations.effect.ui.tsx'
import { JUST_EARNED, PATTERN_PRO } from './badges_fixtures.test.lib.ts'

afterEach(cleanup)

const NO_MOTION_PREFERENCE: MotionPreference = { prefersReduced: () => false, subscribe: () => () => undefined }
const SECOND = { ...PATTERN_PRO, celebrated: false }

/** A server whose new-badge list the test edits, recording what was marked celebrated. */
function server(initial: readonly BadgeRecord[]): { waiting: readonly BadgeRecord[]; readonly marked: [number, string][]; readonly asked: number[] } {
  return { waiting: initial, marked: [], asked: [] }
}

function bound(fake: ReturnType<typeof server>, timers: ManualTimers): ReturnType<typeof bindBadgeCelebrations> {
  return bindBadgeCelebrations({
    loadNew: (id) => {
      fake.asked.push(id)
      return Promise.resolve(fake.waiting)
    },
    markCelebrated: (id, key) => {
      fake.marked.push([id, key])
      fake.waiting = fake.waiting.filter((b) => b.key !== key)
      return Promise.resolve()
    },
    timers,
    motion: NO_MOTION_PREFERENCE,
    pollMs: 5000,
  })
}

async function tick(timers: ManualTimers, ms: number): Promise<void> {
  await act(async () => {
    timers.advance(ms)
    await Promise.resolve()
  })
}

describe('bindBadgeCelebrations', () => {
  it('celebrates each new badge in turn, marking each one seen', async () => {
    const fake = server([JUST_EARNED, SECOND])
    const Celebrations = bound(fake, manualTimers())
    render(<Celebrations profileId={4} mode="party" />)
    expect(await screen.findByRole('heading', { name: 'On a Roll' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Next badge (1 more)' }))
    expect(screen.getByRole('heading', { name: 'Pattern Pro' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Awesome!' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(fake.marked).toEqual([
      [4, 'streak-3'],
      [4, 'pattern-pro'],
    ])
  })

  it('shows the art as soon as a poll brings it', async () => {
    const fake = server([JUST_EARNED])
    const timers = manualTimers()
    const Celebrations = bound(fake, timers)
    render(<Celebrations profileId={4} mode="party" />)
    expect((await screen.findByRole('status')).textContent).toContain('Painting')
    fake.waiting = [{ ...JUST_EARNED, art_status: 'ready', personal_art_url: '/static/badge-art/new.webp' }]
    await tick(timers, 5000)
    expect(screen.getByText('✨ Painted just for you!')).toBeTruthy()
    expect(fake.asked).toEqual([4, 4])
  })

  it('in a game, only toasts each new badge once and leaves the party for later', async () => {
    const fake = server([])
    const timers = manualTimers()
    const Celebrations = bound(fake, timers)
    render(<Celebrations profileId={4} mode="toast" />)
    await tick(timers, 0)
    expect(screen.queryByRole('status')).toBeNull()
    fake.waiting = [JUST_EARNED]
    await tick(timers, 5000)
    const toast = screen.getByRole('status')
    expect(toast.textContent).toContain('On a Roll')
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.animationEnd(toast)
    expect(screen.queryByRole('status')).toBeNull()
    await tick(timers, 5000)
    expect(screen.queryByRole('status')).toBeNull()
    expect(fake.marked).toEqual([])
  })

  it('throws the party once the kid is back from the game', async () => {
    const fake = server([JUST_EARNED])
    const Celebrations = bound(fake, manualTimers())
    const { rerender } = render(<Celebrations profileId={4} mode="toast" />)
    await screen.findByRole('status')
    rerender(<Celebrations profileId={4} mode="party" />)
    expect(screen.getByRole('dialog', { name: 'New badge!' })).toBeTruthy()
  })
})
