import type { WaveConfig } from '@app/zombies/zombie_wave_engine.pure.lib.ts'
import type { ArenaDebug } from './zombie_arena_state.pure.lib.ts'

/**
 * The arena's pure rules: round timings, the phases a round moves through,
 * and the derived values the view renders from them. The state machine that
 * drives them is use_arena_session.pure.hook.ts.
 */

/**
 * Every wave spawns exactly four carriers (createWave takes the brain's four
 * options), and the roster matches. Growing the character registry doesn't
 * change this: the roster is still four uniques chosen from what's enabled.
 */
export const ROSTER_SIZE = 4
export const WRONG_HIT_SPEED_BOOST = 0.18

/** A beat where the question fills the screen before the carriers spawn, so a kid can read it before the clock starts. */
export const INTRO_MS = 1100
export const SOLVED_DELAY_MS = 700
export const CONTACT_HOLD_MS = 700
/** The "reach" clip's swipe lands partway through it, about two-thirds of the contact hold. Nudge if the sound and swipe drift apart. */
export const ZOMBIE_ATTACK_SOUND_DELAY_MS = 450
/** A small gap so the body-hit impact doesn't land in the same instant as the shot sound (the two otherwise read as one). */
export const ZOMBIE_HIT_SOUND_DELAY_MS = 90
export const IMPACT_SHAKE_MS = 200
export const IMPACT_SETTLE_MS = 400
export const IMPACT_TO_FROZEN_MS = 800
/** The correct/wrong vignette: fades in fast and out smooth, then clears so the next hit (even the same kind) replays. */
export const ANSWER_FEEDBACK_MS = 420
/** A wrong hit's shake: much shorter and weaker (wrongHitShake in index.css) than the player-attacked screenShake. */
export const WRONG_HIT_SHAKE_MS = 220

export type ArenaPhase =
  | 'start'
  | 'intro'
  | 'playing'
  | 'contact'
  | 'impact'
  | 'life_lost_frozen'
  | 'transitioning_to_next_wave'
  | 'complete'
  | 'game_over'

/**
 * A resolved shot's or attack's visual feedback, as a discrete event with an
 * incrementing id: each one renders exactly once and is never replayed by an
 * unrelated render, and "correct" and "wrong" can't be confused the way one
 * shared flag would allow.
 */
export type FeedbackKind = 'correctHit' | 'wrongHit' | 'playerAttacked'

export interface FeedbackEvent {
  readonly kind: FeedbackKind
  readonly id: number
}

export interface SessionQuestionResult {
  readonly question: string
  readonly correct: boolean
  readonly timeTakenMs: number
}

export function buildWaveConfig(approachMs: number, cockingMs: number): WaveConfig {
  return { approachMs, wrongHitSpeedBoost: WRONG_HIT_SPEED_BOOST, cockingMs }
}

/** A round is in progress (music plays) from Start until it's complete or over. */
export function isRoundInProgress(phase: ArenaPhase): boolean {
  return phase !== 'start' && phase !== 'complete' && phase !== 'game_over'
}

/** The full-window 3D view shows for these; start/complete/game-over are regular centred cards. */
export function isGamePhase(phase: ArenaPhase): boolean {
  return isRoundInProgress(phase) && phase !== 'transitioning_to_next_wave'
}

/**
 * The container's shake. Only one is ever active: a wrong hit that also ends
 * the wave never becomes a `wrongHit` event, so `impact` and `wrongHit` never
 * overlap. Reduced motion turns both off.
 */
export function containerAnimation(phase: ArenaPhase, feedback: FeedbackEvent | null, reducedMotion: boolean): string {
  if (reducedMotion) return 'none'
  if (phase === 'impact') return `screenShake ${String(IMPACT_SHAKE_MS + IMPACT_SETTLE_MS)}ms ease-out`
  if (feedback?.kind === 'wrongHit') return `wrongHitShake ${String(WRONG_HIT_SHAKE_MS)}ms ease-out`
  return 'none'
}

export function formatResponseTime(timeTakenMs: number): string {
  return `${(timeTakenMs / 1000).toFixed(1)}s`
}

export function summarizeResults(results: readonly SessionQuestionResult[]): { readonly correctCount: number; readonly averageMs: number } {
  const correctCount = results.filter((result) => result.correct).length
  const averageMs = results.length > 0 ? results.reduce((sum, result) => sum + result.timeTakenMs, 0) / results.length : 0
  return { correctCount, averageMs }
}

/** The aim point (-1..1 each way, y up) for a pointer position inside `rect`. */
export function aimFromPointer(clientX: number, clientY: number, rect: { readonly left: number; readonly top: number; readonly width: number; readonly height: number }): { readonly x: number; readonly y: number } {
  return { x: ((clientX - rect.left) / rect.width) * 2 - 1, y: -(((clientY - rect.top) / rect.height) * 2 - 1) }
}

/**
 * The dev-only views. Never on outside a dev build, whatever the URL says
 * (`isDev` is `import.meta.env.DEV`, read in assembly), and only for the
 * exact query values.
 */
export function arenaDebugFrom(isDev: boolean, search: string): ArenaDebug {
  const params = new URLSearchParams(search)
  return { lanes: isDev && params.get('debugLanes') === '1', weaponTuning: isDev && params.get('tuneWeapon') === '1' }
}
