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
 * approaching a danger line, and exactly **two shots** — every accepted
 * shot (hit or miss) consumes one, tracked by `shotsRemaining` and
 * `weaponPhase`. Every carrier — correct or incorrect — is a one-shot
 * defeat: any accepted hit, headshot or body shot, defeats it immediately.
 * `HitZone` is still recorded on the carrier and on `lastHit` purely as
 * classification data for a future scoring system (headshots are intended
 * to be worth more points) — it no longer gates *whether* a hit defeats
 * the carrier, only which death animation and `resolutionReason` apply.
 *
 * Defeating the correct carrier (either shot) solves the wave. A wrong
 * first shot (hit or miss) speeds up survivors and begins `cocking` — the
 * ~900ms window (see `WaveConfig.cockingMs`) during which the second shot
 * isn't accepted yet, ending in `readySecondShot`. A wrong or missed
 * *second* shot ends the wave as a life loss, since both attempts are now
 * spent. Any carrier reaching the danger line also ends the wave as a life
 * loss, at any point — including mid-cocking, which simply never gets to
 * finish once `outcome` stops being `'pending'`. This engine is
 * authoritative for all of that — damage, speed, cooldown/cocking gating,
 * and *why* a wave ended — so the renderer never has to duplicate or
 * second-guess these rules. Recoil/cocking *animation* timing is
 * deliberately not modeled here — see `WeaponPhase`'s docstring.
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

/**
 * The gameplay-blocking subset of the weapon's state — this is what
 * `canShoot` actually gates on. `'readyFirstShot'`/`'readySecondShot'`
 * accept a shot; `'cocking'` and `'waveResolved'` don't.
 *
 * The presentation layer's own local "just fired, recoil is playing"
 * transient (`'firingFirstShot'`/`'firingSecondShot'` in the full six-state
 * vocabulary the spec describes) is deliberately *not* persisted here:
 * recoil is a fixed-duration animation, not a gameplay rule, and the
 * renderer already has everything it needs to derive it — the existing
 * `lastHit`/shot-accepted pulse (identical to how `lastHit` already drives
 * the correct/wrong-hit feedback vignette) tells it exactly when a shot was
 * just accepted, and it can hold its own local "recoil is playing" flag for
 * `weapon.recoilDurationMs` without this engine ever needing to track wall
 * time for something with zero effect on whether shooting is allowed.
 */
export type WeaponPhase = 'readyFirstShot' | 'cocking' | 'readySecondShot' | 'waveResolved'

export interface WaveConfig {
  /** Milliseconds to cross from spawn to the danger line at speedMultiplier 1. */
  approachMs: number
  /** Multiplicative speed increase applied when the first shot is wrong
   * (hit or miss) — not applied on the second shot, since the wave always
   * ends immediately after it regardless of outcome. */
  wrongHitSpeedBoost: number
  /** How long (ms) the weapon spends `cocking` between the first and
   * second shot — see `WeaponDefinition.cockingMs` in
   * `lib/weaponDefinitions.ts`, which is where the actual ~900ms value is
   * chosen; this engine only ever receives the plain number. */
  cockingMs: number
}

export type WaveOutcome = 'pending' | 'solved' | 'life_lost'

/** Why a resolved wave ended, for telemetry/UI copy — never re-derived by
 * the renderer from booleans. */
export type ResolutionReason =
  | null
  | 'correct_headshot'
  | 'correct_body'
  | 'second_wrong_defeated'
  | 'shots_exhausted'
  | 'player_contact'

/** One resolved shot's worth of classification data — a discrete event the
 * renderer's visual-feedback layer keys off of (`ZombieMathBlaster`'s
 * `correctHit`/`wrongHit` feedback, and the weapon's own recoil pulse), not
 * a persistent flag: `tick` clears this back to `null` on the very next
 * frame, so it never stays "on" long enough for an unrelated render to
 * replay it. Every hit is a one-shot defeat now, so `defeated` no longer
 * needs representing here — a `lastHit` only ever exists because
 * *something* was just defeated. `zone` is preserved for a future scoring
 * system (headshots are intended to be worth more); `correct` tells the
 * renderer which color to show without having to re-look-up the carrier. */
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
   * carrier — fed to the existing `hints_used` telemetry field unchanged,
   * per the architecture note that this field is reused rather than
   * replaced. */
  wrongShots: number
  /** How many *distinct* incorrect-answer carriers have been fully
   * defeated in this wave — with only two shots total this can only ever
   * reach 0, 1, or 2, but it's kept (rather than re-derived from
   * `shotsRemaining`) since it's still the clearest way to describe *why*
   * the wave ended in `resolutionReason`/telemetry. */
  wrongCarriersDefeated: number
  /** Shots left this wave — 2 at `createWave`, decremented by every
   * accepted `applyHit`/`registerMiss` call, floor 0. */
  shotsRemaining: number
  weaponPhase: WeaponPhase
  /** Set while `weaponPhase === 'cocking'` to `elapsedMs` at the moment
   * cocking is done; `tick` promotes to `'readySecondShot'` once
   * `elapsedMs` reaches it. `null` whenever not cocking. */
  cockingUntilMs: number | null
  outcome: WaveOutcome
  resolutionReason: ResolutionReason
  /** Id of the carrier that solved, or ended, the wave — null until
   * resolved, and stays null for a `shots_exhausted` miss (no carrier to
   * blame). */
  resolvingCarrierId: string | null
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
    shotsRemaining: 2,
    weaponPhase: 'readyFirstShot',
    cockingUntilMs: null,
    outcome: 'pending',
    resolutionReason: null,
    resolvingCarrierId: null,
    lastHit: null,
  }
}

/** Whether a shot (hit or miss) is accepted right now — this is the single
 * source of truth for "is input accepted": the wave must still be pending
 * *and* the weapon must be in one of its two ready phases (not mid-cocking,
 * and not already spent). Replaces the old fixed-cooldown check entirely —
 * cocking (a real ~900ms gameplay gate) is the only thing between shots
 * now, there being only ever two of them. */
export function canShoot(wave: WaveState, _config: WaveConfig): boolean {
  if (wave.outcome !== 'pending') return false
  return wave.weaponPhase === 'readyFirstShot' || wave.weaponPhase === 'readySecondShot'
}

/** Advances the wave by `dtMs`. A no-op once the wave is no longer pending —
 * "no ticks mutate a resolved wave" is enforced here, once, rather than at
 * every call site. Also where `cocking` is promoted to `readySecondShot`
 * once its timer elapses — if a carrier reaches the player in the very
 * same tick, the contact resolution below takes priority and the cocking
 * sequence never gets to finish (`weaponPhase` becomes `waveResolved`
 * instead), which is exactly the "zombie reaching the player cancels
 * cocking" rule the renderer relies on this to enforce. */
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
      weaponPhase: 'waveResolved',
      cockingUntilMs: null,
    }
  }

  if (wave.weaponPhase === 'cocking' && wave.cockingUntilMs != null && elapsedMs >= wave.cockingUntilMs) {
    return { ...wave, carriers, elapsedMs, lastHit: null, weaponPhase: 'readySecondShot', cockingUntilMs: null }
  }

  return { ...wave, carriers, elapsedMs, lastHit: null }
}

/** Registers a trigger pull that hit nothing (crosshair/raycast wasn't over
 * any carrier — a "background miss"). Consumes a shot exactly like a real
 * hit does, but otherwise has no damage/telemetry effect: a miss on the
 * first shot begins cocking (with no speed penalty — that's specifically
 * for a *wrong-target* first shot); a miss on the second (and final) shot
 * ends the wave as a life loss, since both attempts are now spent. */
export function registerMiss(wave: WaveState, config: WaveConfig): WaveState {
  if (!canShoot(wave, config)) return wave

  const isFinalShot = wave.shotsRemaining <= 1
  const shotsRemaining = Math.max(0, wave.shotsRemaining - 1)

  if (!isFinalShot) {
    return {
      ...wave,
      shotsRemaining,
      lastHit: null,
      weaponPhase: 'cocking',
      cockingUntilMs: wave.elapsedMs + config.cockingMs,
    }
  }

  return {
    ...wave,
    shotsRemaining,
    lastHit: null,
    weaponPhase: 'waveResolved',
    outcome: 'life_lost',
    resolutionReason: 'shots_exhausted',
  }
}

/** Applies one accepted shot to `carrierId` in `zone`. Every accepted hit on
 * an active carrier is a one-shot defeat, headshot or body shot alike —
 * this is the sole place defeat classification, wrong-shot telemetry, the
 * first-shot-wrong speed/cocking rule, and the second-shot-exhausted life
 * loss are decided. No-op if the wave is resolved, the weapon isn't ready
 * (mid-cocking, or already spent), or the target isn't `active` (defeated
 * carriers, and carriers that reached the player, cannot be hit again —
 * enforced here, not by the renderer remembering to check). */
export function applyHit(wave: WaveState, carrierId: string, zone: HitZone, config: WaveConfig): WaveState {
  if (!canShoot(wave, config)) return wave

  const target = wave.carriers.find((c) => c.id === carrierId)
  if (!target || target.status !== 'active') return wave

  const isFinalShot = wave.shotsRemaining <= 1
  const shotsRemaining = Math.max(0, wave.shotsRemaining - 1)

  // Zone is determined before resolving the carrier — it decides which
  // death animation plays (`defeatedBy`) and which `resolutionReason`
  // applies, and is carried onto `lastHit` unchanged for a future scoring
  // system, but it no longer affects *whether* this hit defeats the target:
  // every accepted hit does.
  const defeatedBy: DefeatedBy = zone === 'head' ? 'headshot' : 'body'
  const carriers = wave.carriers.map((c) => (c.id === carrierId ? { ...c, defeatedBy, status: 'defeated' as const } : c))
  const lastHit: LastHit = { carrierId, zone, correct: target.correct }

  if (target.correct) {
    return {
      ...wave,
      carriers,
      lastHit,
      shotsRemaining,
      weaponPhase: 'waveResolved',
      outcome: 'solved',
      resolutionReason: defeatedBy === 'headshot' ? 'correct_headshot' : 'correct_body',
      resolvingCarrierId: carrierId,
    }
  }

  // Incorrect carrier: every accepted hit counts toward wrong-shot telemetry.
  const wrongShots = wave.wrongShots + 1
  const wrongCarriersDefeated = wave.wrongCarriersDefeated + 1

  if (!isFinalShot) {
    // First shot, wrong: accelerate survivors and begin cocking — the wave
    // stays pending for the second (and final) shot.
    return {
      ...wave,
      carriers,
      lastHit,
      shotsRemaining,
      wrongShots,
      wrongCarriersDefeated,
      weaponPhase: 'cocking',
      cockingUntilMs: wave.elapsedMs + config.cockingMs,
      speedMultiplier: wave.speedMultiplier * (1 + config.wrongHitSpeedBoost),
    }
  }

  // Second (final) shot, wrong: both attempts are now spent — end the wave
  // as a life loss. This is the rule that keeps a kid from clearing a wave
  // by shooting everything.
  return {
    ...wave,
    carriers,
    lastHit,
    shotsRemaining,
    wrongShots,
    wrongCarriersDefeated,
    weaponPhase: 'waveResolved',
    outcome: 'life_lost',
    resolutionReason: 'second_wrong_defeated',
    resolvingCarrierId: carrierId,
  }
}
