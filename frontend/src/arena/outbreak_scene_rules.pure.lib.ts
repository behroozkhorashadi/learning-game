import type { ZombieClipRole } from '@app/zombies/zombie_animation_fallback.pure.lib.ts'
import type { Carrier } from '@app/zombies/zombie_wave_engine.pure.lib.ts'

/** The scene's pure rules (outbreak_scene.pure.ui.tsx renders them). */

export type WavePhase = 'intro' | 'playing' | 'frozen'

export const LANE_COLORS = ['#9D57FA', '#144FFF', '#5BCC2D', '#F59E0B'] as const

export function laneColor(lane: number): string {
  return LANE_COLORS[lane % LANE_COLORS.length] ?? LANE_COLORS[0]
}

/**
 * Which clip a carrier plays. Every hit is a one-shot defeat now (see the wave
 * engine), so `hitReact` has no state to come from in play, though characters
 * may still map it.
 */
export function clipRoleFor(carrier: Carrier, phase: WavePhase): ZombieClipRole {
  if (carrier.status === 'reached_player') return 'reach'
  if (carrier.status === 'defeated') return carrier.defeatedBy === 'headshot' ? 'deadHeadshot' : 'deadBody'
  return phase === 'intro' ? 'idle' : 'approach'
}

/**
 * How far (0..2s) into its walk cycle a carrier starts, so four zombies
 * playing the same clip don't move in lockstep. A hash of the carrier id, so
 * it's stable across renders and the same on every replay.
 */
export function walkPhaseFor(carrierId: string): number {
  let hash = 2166136261
  for (let i = 0; i < carrierId.length; i++) hash = Math.imul(hash ^ carrierId.charCodeAt(i), 16777619)
  return ((hash >>> 0) / 4294967296) * 2
}

/** Vertical FOV for the canvas aspect: a little wider on tall screens so all four lanes stay in frame. */
export function sceneFov(aspectRatio: number): number {
  const t = (aspectRatio - 0.6) / (1.8 - 0.6)
  return Math.min(64, Math.max(50, 64 + (50 - 64) * t))
}
