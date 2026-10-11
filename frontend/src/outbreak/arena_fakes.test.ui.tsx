import { act } from '@testing-library/react'
import type { ComponentType, ReactElement } from 'react'
import type { AttemptBody } from '@app/api/practice_schema.pure.lib.ts'
import type { ItemRecord } from '@app/api/practice_schema.pure.lib.ts'
import type { components } from '@app/api/openapi_schema.pure.lib.ts'
import type { OutbreakViewportProps } from '@app/arena/outbreak_viewport.pure.ui.tsx'
import { STARTER_BLASTER } from '@app/blaster/weapon_definitions.pure.lib.ts'
import type { MotionPreference } from '@app/motion/use_prefers_reduced_motion.pure.hook.ts'
import { ZOMBIE_CHARACTER_REGISTRY, type CharacterDefinition } from '@app/zombies/character_definitions.pure.lib.ts'
import { bindFactFluencyBrain } from './fact_fluency_brain.effect.lib.ts'
import { bindZombieArena, type ZombieArenaProps } from './zombie_arena.effect.ui.tsx'
import type { ArenaAudio, ArenaDebug, ArenaScheduler, Cancel } from './zombie_arena_state.pure.lib.ts'

/**
 * Fakes for the arena's tests and stories: a virtual-time scheduler, a
 * recording audio system, fact-fluency items, and a plain-DOM stand-in for the
 * 3D view whose buttons fire the same hit/miss callbacks the real raycaster
 * does (one head and one body button per carrier, and a background miss).
 */

export const ROUNDS = [
  { answer: 7, options: [6, 7, 8, 5] },
  { answer: 9, options: [9, 10, 8, 11] },
  { answer: 6, options: [5, 6, 7, 4] },
  { answer: 12, options: [12, 13, 11, 10] },
  { answer: 4, options: [3, 4, 5, 6] },
] as const

export function factItem(i: number, approachMs = 8000): ItemRecord {
  const round = ROUNDS[Math.min(i, ROUNDS.length - 1)] ?? ROUNDS[0]
  return {
    item_id: `item-${String(i)}`,
    game_id: 'fact_fluency',
    level: 2,
    variant_id: null,
    payload: { left: 3, operator: '+', right: round.answer - 3, answer: round.answer, options: [...round.options], approach_ms: approachMs },
  }
}

/** The wrong options of round `i`. */
export function wrongAnswers(i: number): readonly number[] {
  const round = ROUNDS[Math.min(i, ROUNDS.length - 1)] ?? ROUNDS[0]
  return round.options.filter((v) => v !== round.answer)
}

export function rightAnswer(i: number): number {
  return (ROUNDS[Math.min(i, ROUNDS.length - 1)] ?? ROUNDS[0]).answer
}

export interface VirtualScheduler extends ArenaScheduler {
  /** Moves virtual time forward in 16ms frames, firing frames and due timers in order, inside act(). */
  readonly advance: (ms: number) => Promise<void>
  readonly frameLoops: () => number
}

/** Timers and frames on a virtual clock the test moves by hand. */
export function virtualScheduler(): VirtualScheduler {
  let now = 0
  let nextId = 0
  const timers = new Map<number, { readonly at: number; readonly run: () => void }>()
  const frames = new Map<number, (nowMs: number) => void>()
  function step(to: number): void {
    for (;;) {
      let dueId: number | null = null
      let dueAt = Infinity
      for (const [id, timer] of timers) {
        if (timer.at <= to && timer.at < dueAt) {
          dueId = id
          dueAt = timer.at
        }
      }
      const due = dueId === null ? undefined : timers.get(dueId)
      if (dueId === null || due === undefined) break
      timers.delete(dueId)
      now = Math.max(now, due.at)
      due.run()
    }
    now = to
  }
  return {
    after: (ms, run): Cancel => {
      const id = nextId++
      timers.set(id, { at: now + ms, run })
      return () => {
        timers.delete(id)
      }
    },
    everyFrame: (onFrame): Cancel => {
      const id = nextId++
      frames.set(id, onFrame)
      return () => {
        frames.delete(id)
      }
    },
    advance: async (ms) => {
      const end = now + ms
      while (now < end) {
        const to = Math.min(end, now + 16)
        await act(async () => {
          step(to)
          for (const onFrame of frames.values()) onFrame(now)
          await Promise.resolve()
        })
      }
    },
    frameLoops: () => frames.size,
  }
}

export type AudioCall = keyof ArenaAudio

export function recordingAudio(): ArenaAudio & { readonly calls: readonly AudioCall[]; readonly count: (call: AudioCall) => number } {
  const calls: AudioCall[] = []
  let muted = false
  const record =
    (call: AudioCall) =>
    (): void => {
      calls.push(call)
    }
  return {
    calls,
    count: (call) => calls.filter((c) => c === call).length,
    isMuted: () => muted,
    toggleMuted: () => {
      calls.push('toggleMuted')
      muted = !muted
      return muted
    },
    preloadWeapon: record('preloadWeapon'),
    preloadZombies: record('preloadZombies'),
    preloadMusic: record('preloadMusic'),
    startMusic: record('startMusic'),
    stopMusic: record('stopMusic'),
    playShot: record('playShot'),
    playReload: record('playReload'),
    playGroan: record('playGroan'),
    playZombieHit: record('playZombieHit'),
    playZombieAttack: record('playZombieAttack'),
  }
}

/** The 3D view as buttons: `headshot 7`, `bodyshot 7` per carrier, `background miss`, and the lane characters as a list. */
export function FakeViewport({ carriers, charactersByLane, onHit, onMiss }: OutbreakViewportProps): ReactElement {
  return (
    <div>
      <button type="button" onClick={onMiss}>
        background miss
      </button>
      {carriers.map((c) => (
        <span key={c.id}>
          <button
            type="button"
            onClick={() => {
              onHit(c.id, 'head')
            }}
          >{`headshot ${c.label}`}</button>
          <button
            type="button"
            onClick={() => {
              onHit(c.id, 'body')
            }}
          >{`bodyshot ${c.label}`}</button>
        </span>
      ))}
      <ul aria-label="Lane characters">
        {charactersByLane.map((character, lane) => (
          <li key={`${character.id}-${String(lane)}`}>{character.id}</li>
        ))}
      </ul>
    </div>
  )
}

export const NO_MOTION_PREFERENCE: MotionPreference = { prefersReduced: () => false, subscribe: () => () => undefined }

export interface ArenaHarness {
  readonly ZombieArena: ComponentType<ZombieArenaProps>
  readonly scheduler: VirtualScheduler
  readonly audio: ReturnType<typeof recordingAudio>
  readonly attempts: readonly AttemptBody[]
  readonly ratings: readonly components['schemas']['RatingCreate'][]
  readonly rosterPicks: () => number
}

export interface ArenaHarnessOptions {
  readonly approachMs?: number
  readonly motion?: MotionPreference
  readonly debug?: ArenaDebug
  readonly Viewport?: ComponentType<OutbreakViewportProps>
  readonly nextItemFails?: string
  /** Real time instead of the virtual clock (stories, in a real browser). */
  readonly scheduler?: ArenaScheduler
}

/** The arena bound over fakes: items cycle through ROUNDS, attempts and ratings are recorded, and the roster is the enabled registry. */
export function arenaHarness({ approachMs = 8000, motion = NO_MOTION_PREFERENCE, debug = { lanes: false, weaponTuning: false }, Viewport = FakeViewport, nextItemFails, scheduler: realScheduler }: ArenaHarnessOptions = {}): ArenaHarness {
  const scheduler = virtualScheduler()
  const audio = recordingAudio()
  const attempts: AttemptBody[] = []
  const ratings: components['schemas']['RatingCreate'][] = []
  let items = 0
  let picks = 0
  let sessions = 0
  let waves = 0
  const enabled: readonly CharacterDefinition[] = ZOMBIE_CHARACTER_REGISTRY.filter((c) => c.enabled).slice(0, 4)
  const ZombieArena = bindZombieArena({
    brain: bindFactFluencyBrain({
      recordAttempt: (attempt) => {
        attempts.push(attempt)
        return Promise.resolve()
      },
      reportError: () => undefined,
    }),
    weapon: STARTER_BLASTER,
    nextItem: () => (nextItemFails === undefined ? Promise.resolve(factItem(items++, approachMs)) : Promise.reject(new Error(nextItemFails))),
    submitRating: (rating) => {
      ratings.push(rating)
      return Promise.resolve()
    },
    scheduler: realScheduler ?? scheduler,
    audio,
    roster: {
      pickForSession: () => {
        picks += 1
        return enabled
      },
      // Rotate by one more lane each wave: a real reshuffle, deterministically.
      shuffleLanes: (roster) => {
        waves += 1
        const by = waves % Math.max(1, roster.length)
        return [...roster.slice(by), ...roster.slice(0, by)]
      },
    },
    createSessionId: () => `session-${String(++sessions)}`,
    Viewport,
    motion,
    debug,
    speakText: () => undefined,
    copyText: () => Promise.resolve(),
  })
  return { ZombieArena, scheduler, audio, attempts, ratings, rosterPicks: () => picks }
}
