import type { ShotZone, ShotPower } from './horde_armory.pure.lib.ts'
import { answerFor, type HordeEvent, type HordeOutcome, type HordeQuestion, type HordeState, type Posture } from './horde_engine.pure.lib.ts'
import type { Cover } from './horde_field.pure.lib.ts'
import { visibilityOf, type Visibility } from './horde_visibility.pure.lib.ts'

/**
 * A recording of one Zombie Horde round, for replaying it later: what was on
 * screen twice a second (every zombie's position, facing, posture, health,
 * answer, and how visible it was past the cover), plus every question, shot,
 * grenade, push-back, flag, and game event at the moment it happened.
 *
 * The map, camera, and characters are stored once, in the header, so a
 * snapshot plus the header is enough to redraw that moment. Numbers are
 * rounded so a 60-second round is a few tens of KB of JSON.
 *
 * Pure: snapshot-in/recording-out. The round hook holds the recording and
 * saves it when the round ends (or is left).
 */

export const RECORDING_VERSION = 1
/** How often the field is captured, besides at every mark. */
export const SNAPSHOT_MS = 500

export interface RecordingHeader {
  readonly version: number
  readonly sessionId: string
  /** ISO time the round started. */
  readonly startedAt: string
  readonly seed: number
  readonly weaponId: string
  readonly bulletId: string
  readonly travelMs: number
  readonly cooldownMs: number
  readonly power: ShotPower
  readonly basePower: ShotPower
  readonly camera: readonly [number, number, number]
  readonly cover: readonly Cover[]
  /** Character id per slot. */
  readonly characters: readonly string[]
}

export interface ZombieFrame {
  readonly slot: number
  readonly id: string
  readonly x: number
  readonly depth: number
  readonly heading: number
  readonly posture: Posture
  readonly health: number
  readonly answer: string | null
  readonly correct: boolean
  readonly visibility: Visibility
}

export interface Snapshot {
  readonly t: number
  readonly question: string | null
  readonly lives: number
  readonly ammo: number
  readonly grenades: number
  readonly shoves: number
  /** Where the player was aiming (-1..1 each way, y up), or null with no pointer. */
  readonly aim: { readonly x: number; readonly y: number } | null
  readonly zombies: readonly ZombieFrame[]
  readonly projectiles: readonly { readonly fromX: number; readonly fromDepth: number; readonly landsAt: number }[]
}

/** What a shot was aimed at and what it hit, as the player saw it. */
export interface ShotDetail {
  readonly aim: { readonly x: number; readonly y: number } | null
  /** The cover that blocked it, if it was blocked. */
  readonly blockedBy: string | null
  /** A click in the 3D view, or an answer button. */
  readonly via: 'click' | 'button'
}

export type Mark =
  | { readonly t: number; readonly type: 'question'; readonly text: string; readonly summary: string; readonly answers: readonly (string | null)[] }
  | {
      readonly t: number
      readonly type: 'shot'
      readonly mode: 'shot' | 'shove'
      readonly aim: { readonly x: number; readonly y: number } | null
      readonly via: 'click' | 'button'
      readonly blockedBy: string | null
      /** The zombie the ray reached, and what it carried then; null for a miss or a blocked shot. */
      readonly target: { readonly zombieId: string; readonly slot: number; readonly zone: ShotZone; readonly answer: string | null; readonly correct: boolean } | null
      /** The engine ignored it (cooling down, no push-backs left). */
      readonly ignored: boolean
    }
  | { readonly t: number; readonly type: 'grenade'; readonly x: number; readonly depth: number }
  | { readonly t: number; readonly type: 'flag'; readonly n: number }
  | { readonly t: number; readonly type: 'event'; readonly event: HordeEvent }

export interface Recording {
  readonly header: RecordingHeader
  readonly snapshots: readonly Snapshot[]
  readonly marks: readonly Mark[]
  readonly flags: number
  /** Set when the round ends: survived, overrun, or left before the clock ran out. */
  readonly outcome: HordeOutcome | 'left' | null
  readonly durationMs: number
}

const round2 = (n: number): number => Math.round(n * 100) / 100

export function startRecording(header: RecordingHeader): Recording {
  return { header, snapshots: [], marks: [], flags: 0, outcome: null, durationMs: 0 }
}

export function snapshotOf(state: HordeState, aim: { readonly x: number; readonly y: number } | null, cover: readonly Cover[]): Snapshot {
  return {
    t: Math.round(state.elapsedMs),
    question: state.question?.text ?? null,
    lives: state.lives,
    ammo: state.ammo,
    grenades: state.grenades,
    shoves: state.shoves,
    aim: aim === null ? null : { x: round2(aim.x), y: round2(aim.y) },
    zombies: state.zombies.map((zombie): ZombieFrame => {
      const answer = answerFor(state, zombie)
      return {
        slot: zombie.slot,
        id: zombie.id,
        x: round2(zombie.x),
        depth: round2(zombie.depth),
        heading: round2(zombie.heading),
        posture: zombie.posture,
        health: zombie.health,
        answer: answer?.label ?? null,
        correct: answer?.correct ?? false,
        visibility: zombie.posture === 'gone' ? 'hidden' : visibilityOf(zombie, cover),
      }
    }),
    projectiles: state.projectiles.map((p) => ({ fromX: round2(p.fromX), fromDepth: round2(p.fromDepth), landsAt: Math.round(p.landsAtMs) })),
  }
}

/** Captures the field if a snapshot is due (or `force`), and the state's events as marks. */
export function withFrame(recording: Recording, state: HordeState, aim: { readonly x: number; readonly y: number } | null, force = false): Recording {
  const last = recording.snapshots.at(-1)
  const due = force || last === undefined || state.elapsedMs - last.t >= SNAPSHOT_MS
  const t = Math.round(state.elapsedMs)
  const marks = state.events.length === 0 ? recording.marks : [...recording.marks, ...state.events.map((event): Mark => ({ t, type: 'event', event }))]
  if (!due && marks === recording.marks) return recording
  return { ...recording, marks, snapshots: due ? [...recording.snapshots, snapshotOf(state, aim, recording.header.cover)] : recording.snapshots, durationMs: t }
}

export function withQuestion(recording: Recording, state: HordeState, question: HordeQuestion): Recording {
  const answers = state.zombies.map((zombie) => answerFor(state, zombie)?.label ?? null)
  return { ...recording, marks: [...recording.marks, { t: Math.round(state.elapsedMs), type: 'question', text: question.text, summary: question.summary, answers }] }
}

/** A shot or push-back, taken against `before` (what the player saw), with what came of it in `after`. */
export function withShot(
  recording: Recording,
  before: HordeState,
  after: HordeState,
  target: { readonly zombieId: string; readonly zone: ShotZone } | null,
  detail: ShotDetail,
  mode: 'shot' | 'shove',
  aim: { readonly x: number; readonly y: number } | null,
): Recording {
  const zombie = target === null ? undefined : before.zombies.find((z) => z.id === target.zombieId)
  const answer = zombie === undefined ? null : answerFor(before, zombie)
  const mark: Mark = {
    t: Math.round(before.elapsedMs),
    type: 'shot',
    mode,
    aim: detail.aim === null ? null : { x: round2(detail.aim.x), y: round2(detail.aim.y) },
    via: detail.via,
    blockedBy: detail.blockedBy,
    target: target === null || zombie === undefined ? null : { zombieId: zombie.id, slot: zombie.slot, zone: target.zone, answer: answer?.label ?? null, correct: answer?.correct ?? false },
    ignored: after === before,
  }
  // The field as it was when the shot was taken, so the moment can be redrawn exactly.
  const withBefore = { ...recording, marks: [...recording.marks, mark], snapshots: [...recording.snapshots, snapshotOf(before, aim, recording.header.cover)] }
  return after === before ? withBefore : withFrame(withBefore, after, aim, true)
}

export function withGrenade(recording: Recording, before: HordeState, after: HordeState, at: { readonly x: number; readonly depth: number }, aim: { readonly x: number; readonly y: number } | null): Recording {
  const marked: Recording = { ...recording, marks: [...recording.marks, { t: Math.round(before.elapsedMs), type: 'grenade', x: round2(at.x), depth: round2(at.depth) }] }
  return after === before ? marked : withFrame(marked, after, aim, true)
}

/** A moment the player flagged; numbered from 1 so they can say "flag 2". */
export function withFlag(recording: Recording, state: HordeState, aim: { readonly x: number; readonly y: number } | null): Recording {
  const n = recording.flags + 1
  const flagged = { ...recording, flags: n, marks: [...recording.marks, { t: Math.round(state.elapsedMs), type: 'flag' as const, n }] }
  return { ...flagged, snapshots: [...flagged.snapshots, snapshotOf(state, aim, recording.header.cover)] }
}

export function finished(recording: Recording, state: HordeState | null, outcome: HordeOutcome | 'left'): Recording {
  return { ...recording, outcome, durationMs: state === null ? recording.durationMs : Math.round(state.elapsedMs) }
}
