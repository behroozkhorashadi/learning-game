import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { BadgeRecord } from '@app/api/badges_schema.pure.lib.ts'
import type { MotionPreference } from '@app/motion/use_prefers_reduced_motion.pure.hook.ts'
import { manualTimers } from '@app/timing/manual_timers.test.lib.ts'
import { bindBadges, type BadgesDeps } from './badges.effect.ui.tsx'
import { ART, BADGES, FIXTURE_NOW, JUST_EARNED, STATS, ZOMBIE_SLAYER } from './badges_fixtures.test.lib.ts'

afterEach(cleanup)

const NO_MOTION_PREFERENCE: MotionPreference = { prefersReduced: () => false, subscribe: () => () => undefined }

function deps(overrides: Partial<BadgesDeps> = {}): BadgesDeps {
  return {
    loadBadges: () => Promise.resolve(BADGES),
    loadStats: () => Promise.resolve(STATS),
    loadGallery: () => Promise.resolve(ART),
    paint: () => Promise.reject(new Error('not painting in this test')),
    motion: NO_MOTION_PREFERENCE,
    now: () => FIXTURE_NOW,
    timers: manualTimers(),
    pollMs: 5000,
    ...overrides,
  }
}

/** A promise the test settles. */
function deferred<T>(): { readonly promise: Promise<T>; readonly resolve: (value: T) => void; readonly reject: (error: Error) => void } {
  let resolve: (value: T) => void = () => undefined
  let reject: (error: Error) => void = () => undefined
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function openZombieSlayer(): HTMLElement {
  fireEvent.click(within(screen.getByRole('region', { name: 'Game masters' })).getByRole('button', { name: /^Zombie Slayer: earned/ }))
  return screen.getByRole('dialog', { name: 'Zombie Slayer' })
}

describe('bindBadges', () => {
  it('loads badges, stats, and the art gallery for the profile, then shows them', async () => {
    const asked: number[] = []
    const galleryAsked: number[] = []
    const Badges = bindBadges(
      deps({
        loadBadges: (id) => {
          asked.push(id)
          return Promise.resolve(BADGES)
        },
        loadGallery: (id) => {
          galleryAsked.push(id)
          return Promise.resolve(ART)
        },
      }),
    )
    render(<Badges profileId={7} kidName="Mia" onBack={() => undefined} />)
    expect(screen.getByRole('status')).toBeTruthy()
    expect(await screen.findByText('Badges & prizes')).toBeTruthy()
    expect(await screen.findByRole('img', { name: 'Comic Hero: a pet dragon' })).toBeTruthy()
    expect(asked).toEqual([7])
    expect(galleryAsked).toEqual([7])
  })

  it('paints a badge for this profile, then shows the painted badge', async () => {
    const painting = deferred<BadgeRecord>()
    const asked: [number, string][] = []
    const Badges = bindBadges(
      deps({
        paint: (id, key) => {
          asked.push([id, key])
          return painting.promise
        },
      }),
    )
    render(<Badges profileId={7} kidName="Mia" onBack={() => undefined} />)
    await screen.findByText('Badges & prizes')
    fireEvent.click(within(openZombieSlayer()).getByRole('button', { name: 'Try painting again' }))
    expect(asked).toEqual([[7, 'zombie-slayer']])
    expect(screen.getByRole('status').textContent).toContain('Painting your one-of-a-kind badge')

    await act(async () => {
      painting.resolve({ ...ZOMBIE_SLAYER, art_status: 'ready', personal_art_url: '/static/badge-art/z.webp' })
      await painting.promise
    })
    expect(screen.getByText('This badge was painted just for you. No one else has one like it!')).toBeTruthy()
    expect(screen.getByRole('dialog').querySelector('image')?.getAttribute('href')).toBe('/static/badge-art/z.webp')
  })

  it('looks again while a just-earned badge is still painting, and stops once its art lands', async () => {
    const timers = manualTimers()
    let shelf: readonly BadgeRecord[] = [JUST_EARNED]
    let loads = 0
    const Badges = bindBadges(
      deps({
        timers,
        loadBadges: () => {
          loads += 1
          return Promise.resolve(shelf)
        },
      }),
    )
    render(<Badges profileId={7} kidName="Mia" onBack={() => undefined} />)
    await screen.findByText('Badges & prizes')
    shelf = [{ ...JUST_EARNED, art_status: 'ready', personal_art_url: '/static/badge-art/fire.webp' }]
    await act(async () => {
      timers.advance(5000)
      await Promise.resolve()
    })
    fireEvent.click(within(screen.getByRole('region', { name: 'Streaks' })).getByRole('button', { name: /^On a Roll: earned/ }))
    expect(screen.getByRole('dialog').querySelector('image')?.getAttribute('href')).toBe('/static/badge-art/fire.webp')
    const settled = loads
    await act(async () => {
      timers.advance(20000)
      await Promise.resolve()
    })
    expect(loads).toBe(settled)
    expect(timers.pending()).toBe(0)
  })

  it('offers another try when painting fails', async () => {
    const painting = deferred<BadgeRecord>()
    const Badges = bindBadges(deps({ paint: () => painting.promise }))
    render(<Badges profileId={7} kidName="Mia" onBack={() => undefined} />)
    await screen.findByText('Badges & prizes')
    fireEvent.click(within(openZombieSlayer()).getByRole('button', { name: 'Try painting again' }))
    await act(async () => {
      painting.reject(new Error('POST failed with HTTP 500'))
      await painting.promise.catch(() => undefined)
    })
    expect(screen.getByText('The paint got smudged. Want to try again?')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Try painting again' })).toBeTruthy()
  })

  it('still shows the badges when only the gallery fails', async () => {
    const Badges = bindBadges(deps({ loadGallery: () => Promise.reject(new Error('GET /api/profiles/7/armory/art failed with HTTP 500')) }))
    render(<Badges profileId={7} kidName="Mia" onBack={() => undefined} />)
    expect((await screen.findByRole('alert')).textContent).toBe("Your gallery couldn't load (GET /api/profiles/7/armory/art failed with HTTP 500).")
    expect(await screen.findByRole('button', { name: /^Pattern Pro: earned/ })).toBeTruthy()
  })

  it('shows the failure when either request fails', async () => {
    const Badges = bindBadges(deps({ loadStats: () => Promise.reject(new Error('GET /api/profiles/7/stats failed with HTTP 500')) }))
    await act(async () => {
      render(<Badges profileId={7} kidName="Mia" onBack={() => undefined} />)
    })
    expect(screen.getByRole('alert').textContent).toBe('Error: GET /api/profiles/7/stats failed with HTTP 500')
  })
})
