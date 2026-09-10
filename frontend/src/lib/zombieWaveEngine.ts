/**
 * Pure, framework-free state machine for one "wave" of Equation Outbreak's
 * approach-and-shoot mechanic (internal game id remains `fact_fluency`; see
 * fact_fluency.py). No DOM, no timers, no requestAnimationFrame, no Three.js —
 * the 3D renderer (ZombieMathBlaster.tsx and its scene components) owns the
 * animation loop, raycasting, and rendering, and drives this engine with
 * `tick`/`applyHit`/`registerMiss`. Mirrors this codebase's existing split
 * between a pure adaptive-difficulty engine (backend `app/engine/loop_a.py`)
 * and the stateful service that wires it up.
 *
 * A wave is one equation with four candidate "carriers" (visually zombies)
 * approaching a danger line. Every carrier — correct or incorrect — is a
 * one-shot defeat: any accepted hit, headshot or body shot, defeats it
 * immediately. `HitZone` is still recorded on the carrier and on `lastHit`
 * purely as classification data for a future scoring system (headshots are
 * intended to be worth more points) — it no longer gates *whether* a hit
 * defeats the carrier, only which death animation and `resolutionReason`
 * apply. Defeating the correct carrier solves the wave. Defeating a second
 * *incorrect* carrier in the same wave ends it as a life loss (this exists
 * so a kid can't just spray shots at everything). Any carrier reaching the
 * danger line also ends the wave as a life loss. This engine is authoritative
 * for all of that — damage, speed, cooldown, and *why* a wave ended — so the
 * renderer never has to duplicate or second-guess these rules.
 */

export type CarrierRuntimeStatus = 'active' | 'defeated' | 'reached_player'
export type DefeatedBy = 'headshot' | 'body' | null
export type HitZone = 'head' | 'body'

export interface CarrierOption {
  id: string
  value: number
  correct: boolean
}

export interface Carrier extends CarrierOption {
  lane: number
  /** 0 = just spawned, 1 = reached the danger line. */
  distance: number
  status: CarrierRuntimeStatus
  defeatedBy: DefeatedBy
}

export interface WaveConfig {
  /** Milliseconds to cross from spawn to the danger line at speedMultiplier 1. */
  approachMs: number
  /** Multiplicative speed increase applied when the first wrong-answer
   * carrier is defeated in a wave (e.g. 0.18 = +18%). Not applied per-hit —
   * only on that specific defeat (see `applyHit`). */
  wrongHitSpeedBoost: number
  /** Minimum time between two accepted shots; a shot inside this window is a
   * no-op, whether it hits, misses, or is a background miss. This is where
   * the selected weapon's cooldown (see `lib/weaponDefinitions.ts`) enters
   * the engine — as a plain number, never as a weapon-definition import. */
  shotCooldownMs: number
}

export type WaveOutcome = 'pending' | 'solved' | 'life_lost'

/** Why a resolved wave ended, for telemetry/UI copy — never re-derived by
 * the renderer from booleans. */
export type ResolutionReason =
  | null
  | 'correct_headshot'
  | 'correct_body'
  | 'second_wrong_defeated'
  | 'player_contact'

/** One resolved shot's worth of classification data — a discrete event the
 * renderer's visual-feedback layer keys off of (`ZombieMathBlaster`'s
 * `correctHit`/`wrongHit` feedback), not a persistent flag: `tick` clears
 * this back to `null` on the very next frame, so it never stays "on" long
 * enough for an unrelated render to replay it. Every hit is a one-shot
 * defeat now, so `defeated` no longer needs representing here — a
 * `lastHit` only ever exists because *something* was just defeated. `zone`
 * is preserved for a future scoring system (headshots are intended to be
 * worth more); `correct` tells the renderer which color to show without
 * having to re-look-up the carrier. */
export interface LastHit {
  carrierId: string
  zone: HitZone
  correct: boolean
}

export interface WaveState {
  carriers: Carrier[]
  speedMultiplier: number
  elapsedMs: number
  /** Cumulative count of accepted shots landing on any incorrect-answer
   * carrier (including non-final body hits) — fed to the existing
   * `hints_used` telemetry field unchanged, per the architecture note that
   * this field is reused rather than replaced. */
  wrongShots: number
  /** How many *distinct* incorrect-answer carriers have been fully defeated
   * in this wave. Resets to 0 only when a new wave is created — never
   * mutated mid-wave except by a wrong-carrier defeat. */
  wrongCarriersDefeated: number
  outcome: WaveOutcome
  resolutionReason: ResolutionReason
  /** Id of the carrier that solved, or ended, the wave — null until resolved. */
  resolvingCarrierId: string | null
  lastShotAtMs: number | null
  /** Set for one tick/hit's worth of state so the renderer can trigger the
   * right one-shot animation; cleared on the next tick or hit. */
  lastHit: LastHit | null
}

export function createWave(options: CarrierOption[]): WaveState {
  return {
    carriers: options.map((option, lane) => ({
      ...option,
      lane,
      distance: 0,
      status: 'active',
      defeatedBy: null,
    })),
    speedMultiplier: 1,
    elapsedMs: 0,
    wrongShots: 0,
    wrongCarriersDefeated: 0,
    outcome: 'pending',
    resolutionReason: null,
    resolvingCarrierId: null,
    lastShotAtMs: null,
    lastHit: null,
  }
}

/** Whether a shot (hit or miss) is accepted right now — cooldown and wave
 * resolution both gate here, so this is the single source of truth for
 * "is input accepted." */
export function canShoot(wave: WaveState, config: WaveConfig): boolean {
  if (wave.outcome !== 'pending') return false
  if (wave.lastShotAtMs == null) return true
  return wave.elapsedMs - wave.lastShotAtMs >= config.shotCooldownMs
}

/** Advances the wave by `dtMs`. A no-op once the wave is no longer pending —
 * "no ticks mutate a resolved wave" is enforced here, once, rather than at
 * every call site. */
export function tick(wave: WaveState, dtMs: number, config: WaveConfig): WaveState {
  if (wave.outcome !== 'pending') return wave

  const elapsedMs = wave.elapsedMs + dtMs
  const step = (dtMs / config.approachMs) * wave.speedMultiplier
  let contactCarrierId: string | null = null

  const carriers = wave.carriers.map((carrier) => {
    if (carrier.status !== 'active') return carrier
    const distance = Math.min(1, carrier.distance + step)
    if (distance >= 1) {
      // Only the first carrier to cross in this tick becomes "the" contact
      // that resolves the wave; any others crossing in the same tick still
      // visually arrive, but must not trigger a second life loss.
      if (contactCarrierId === null) contactCarrierId = carrier.id
      return { ...carrier, distance, status: 'reached_player' as const }
    }
    return { ...carrier, distance }
  })

  if (contactCarrierId !== null) {
    return {
      ...wave,
      carriers,
      elapsedMs,
      outcome: 'life_lost',
      resolutionReason: 'player_contact',
      resolvingCarrierId: contactCarrierId,
      lastHit: null,
    }
  }

  return { ...wave, carriers, elapsedMs, lastHit: null }
}

/** Registers a trigger pull that hit nothing (crosshair/raycast wasn't over
 * any carrier — a "background miss"). Consumes the same cooldown clock as a
 * real hit, but otherwise has no effect: no damage, no telemetry, no speed
 * change, and it can never resolve a wave. */
export function registerMiss(wave: WaveState, config: WaveConfig): WaveState {
  if (!canShoot(wave, config)) return wave
  return { ...wave, lastShotAtMs: wave.elapsedMs, lastHit: null }
}

/** Applies one accepted shot to `carrierId` in `zone`. Every accepted hit on
 * an active carrier is a one-shot defeat, headshot or body shot alike —
 * this is the sole place defeat classification, wrong-shot telemetry, the
 * wave-acceleration-on-first-wrong-defeat rule, and the second-wrong-defeat
 * life loss are decided. No-op if the wave is resolved, the cooldown hasn't
 * elapsed, or the target isn't `active` (defeated carriers, and carriers
 * that reached the player, cannot be hit again — enforced here, not by the
 * renderer remembering to check). */
export function applyHit(wave: WaveState, carrierId: string, zone: HitZone, config: WaveConfig): WaveState {
  if (!canShoot(wave, config)) return wave

  const target = wave.carriers.find((c) => c.id === carrierId)
  if (!target || target.status !== 'active') return wave

  // Zone is determined before resolving the carrier — it decides which
  // death animation plays (`defeatedBy`) and which `resolutionReason`
  // applies, and is carried onto `lastHit` unchanged for a future scoring
  // system, but it no longer affects *whether* this hit defeats the target:
  // every accepted hit does.
  const defeatedBy: DefeatedBy = zone === 'head' ? 'headshot' : 'body'
  const carriers = wave.carriers.map((c) => (c.id === carrierId ? { ...c, defeatedBy, status: 'defeated' as const } : c))
  const lastShotAtMs = wave.elapsedMs
  const lastHit: LastHit = { carrierId, zone, correct: target.correct }

  if (target.correct) {
    return {
      ...wave,
      carriers,
      lastShotAtMs,
      lastHit,
      outcome: 'solved',
      resolutionReason: defeatedBy === 'headshot' ? 'correct_headshot' : 'correct_body',
      resolvingCarrierId: carrierId,
    }
  }

  // Incorrect carrier: every accepted hit counts toward wrong-shot telemetry.
  const wrongShots = wave.wrongShots + 1
  const wrongCarriersDefeated = wave.wrongCarriersDefeated + 1

  if (wrongCarriersDefeated === 1) {
    // First wrong-carrier defeat: accelerate survivors, keep the wave going.
    return {
      ...wave,
      carriers,
      lastShotAtMs,
      lastHit,
      wrongShots,
      wrongCarriersDefeated,
      speedMultiplier: wave.speedMultiplier * (1 + config.wrongHitSpeedBoost),
    }
  }

  // Second wrong-carrier defeat in this wave: end it as a life loss. This is
  // the rule that keeps a kid from clearing a wave by shooting everything.
  return {
    ...wave,
    carriers,
    lastShotAtMs,
    lastHit,
    wrongShots,
    wrongCarriersDefeated,
    outcome: 'life_lost',
    resolutionReason: 'second_wrong_defeated',
    resolvingCarrierId: carrierId,
  }
}
