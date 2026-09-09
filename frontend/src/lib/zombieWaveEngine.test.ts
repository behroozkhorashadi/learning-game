import { describe, it, expect } from 'vitest'
import {
  createWave,
  tick,
  applyHit,
  registerMiss,
  canShoot,
  HIT_REACTION_LOCK_MS,
  SPAWN_BOUNDARY_DISTANCE,
  type CarrierOption,
  type WaveConfig,
} from './zombieWaveEngine'

const OPTIONS: CarrierOption[] = [
  { id: 'a', value: 6, correct: false },
  { id: 'b', value: 7, correct: true },
  { id: 'c', value: 8, correct: false },
  { id: 'd', value: 5, correct: false },
]

const CONFIG: WaveConfig = { approachMs: 1000, wrongHitSpeedBoost: 0.18, shotCooldownMs: 100, bodyShotKnockback: 0.1 }
const NO_COOLDOWN: WaveConfig = { ...CONFIG, shotCooldownMs: 0 }

/** Fires three body shots at `carrierId`, advancing past cooldown between
 * each so none are rejected — a convenience for tests that just need "this
 * carrier is now defeated by body damage." */
function threeBodyShots(wave: ReturnType<typeof createWave>, carrierId: string) {
  let w = wave
  for (let i = 0; i < 3; i++) {
    w = applyHit(w, carrierId, 'body', NO_COOLDOWN)
  }
  return w
}

describe('createWave', () => {
  it('starts every carrier active, undamaged, at distance 0, in a pending wave', () => {
    const wave = createWave(OPTIONS)
    expect(wave.outcome).toBe('pending')
    expect(wave.speedMultiplier).toBe(1)
    expect(wave.wrongCarriersDefeated).toBe(0)
    expect(wave.carriers).toHaveLength(4)
    for (const carrier of wave.carriers) {
      expect(carrier.status).toBe('active')
      expect(carrier.distance).toBe(0)
      expect(carrier.bodyHits).toBe(0)
      expect(carrier.defeatedBy).toBeNull()
    }
  })
})

describe('damage thresholds (identical for correct and incorrect carriers)', () => {
  it('one headshot defeats the correct carrier', () => {
    const wave = applyHit(createWave(OPTIONS), 'b', 'head', NO_COOLDOWN)
    const carrier = wave.carriers.find((c) => c.id === 'b')!
    expect(carrier.status).toBe('defeated')
    expect(carrier.defeatedBy).toBe('headshot')
  })

  it('one headshot defeats a wrong carrier', () => {
    const wave = applyHit(createWave(OPTIONS), 'a', 'head', NO_COOLDOWN)
    const carrier = wave.carriers.find((c) => c.id === 'a')!
    expect(carrier.status).toBe('defeated')
    expect(carrier.defeatedBy).toBe('headshot')
  })

  it('one body shot does not defeat a carrier', () => {
    const wave = applyHit(createWave(OPTIONS), 'a', 'body', NO_COOLDOWN)
    const carrier = wave.carriers.find((c) => c.id === 'a')!
    expect(carrier.status).toBe('active')
    expect(carrier.bodyHits).toBe(1)
  })

  it('two body shots do not defeat a carrier', () => {
    let wave = createWave(OPTIONS)
    wave = applyHit(wave, 'a', 'body', NO_COOLDOWN)
    wave = applyHit(wave, 'a', 'body', NO_COOLDOWN)
    const carrier = wave.carriers.find((c) => c.id === 'a')!
    expect(carrier.status).toBe('active')
    expect(carrier.bodyHits).toBe(2)
  })

  it('three body shots defeat a carrier', () => {
    const wave = threeBodyShots(createWave(OPTIONS), 'a')
    const carrier = wave.carriers.find((c) => c.id === 'a')!
    expect(carrier.status).toBe('defeated')
    expect(carrier.defeatedBy).toBe('body')
  })

  it('two body shots followed by a headshot is classified as a headshot defeat', () => {
    let wave = createWave(OPTIONS)
    wave = applyHit(wave, 'a', 'body', NO_COOLDOWN)
    wave = applyHit(wave, 'a', 'body', NO_COOLDOWN)
    wave = applyHit(wave, 'a', 'head', NO_COOLDOWN)
    const carrier = wave.carriers.find((c) => c.id === 'a')!
    expect(carrier.status).toBe('defeated')
    expect(carrier.defeatedBy).toBe('headshot')
  })

  it('defeated carriers cannot be hit again', () => {
    let wave = applyHit(createWave(OPTIONS), 'a', 'head', NO_COOLDOWN)
    const afterDefeat = wave
    wave = applyHit(wave, 'a', 'body', NO_COOLDOWN)
    expect(wave).toBe(afterDefeat)
    expect(wave.carriers.find((c) => c.id === 'a')!.bodyHits).toBe(0)
  })
})

describe('body-shot knockback (persistent, per-carrier)', () => {
  it('first body shot reduces only the hit carrier’s distance, by bodyShotKnockback', () => {
    let wave = createWave(OPTIONS)
    wave = tick(wave, 500, CONFIG) // every carrier at distance 0.5
    const before = wave.carriers.map((c) => ({ id: c.id, distance: c.distance }))

    wave = applyHit(wave, 'a', 'body', NO_COOLDOWN)

    const hit = wave.carriers.find((c) => c.id === 'a')!
    expect(hit.distance).toBeCloseTo(0.5 - CONFIG.bodyShotKnockback)

    for (const other of before) {
      if (other.id === 'a') continue
      expect(wave.carriers.find((c) => c.id === other.id)!.distance).toBeCloseTo(other.distance)
    }
  })

  it('a second body shot applies another persistent knockback on top of the first', () => {
    let wave = createWave(OPTIONS)
    wave = tick(wave, 500, CONFIG)
    wave = applyHit(wave, 'a', 'body', NO_COOLDOWN)
    const afterFirst = wave.carriers.find((c) => c.id === 'a')!.distance
    wave = applyHit(wave, 'a', 'body', NO_COOLDOWN)
    const afterSecond = wave.carriers.find((c) => c.id === 'a')!.distance
    expect(afterSecond).toBeCloseTo(afterFirst - CONFIG.bodyShotKnockback)
  })

  it('correct and incorrect carriers receive the identical physical knockback', () => {
    let wave = createWave(OPTIONS)
    wave = tick(wave, 500, CONFIG)
    const wrongWave = applyHit(wave, 'a', 'body', NO_COOLDOWN)
    const correctWave = applyHit(wave, 'b', 'body', NO_COOLDOWN)
    expect(wrongWave.carriers.find((c) => c.id === 'a')!.distance).toBeCloseTo(correctWave.carriers.find((c) => c.id === 'b')!.distance)
  })

  it('knockback cannot move a carrier behind the spawn boundary', () => {
    // Freshly spawned, distance 0 — a body shot right away should clamp at
    // SPAWN_BOUNDARY_DISTANCE rather than go negative.
    const wave = applyHit(createWave(OPTIONS), 'a', 'body', NO_COOLDOWN)
    expect(wave.carriers.find((c) => c.id === 'a')!.distance).toBe(SPAWN_BOUNDARY_DISTANCE)
  })

  it('headshots do not apply the non-final body-shot knockback', () => {
    let wave = createWave(OPTIONS)
    wave = tick(wave, 500, CONFIG)
    wave = applyHit(wave, 'a', 'head', NO_COOLDOWN)
    expect(wave.carriers.find((c) => c.id === 'a')!.distance).toBeCloseTo(0.5)
  })

  it('the third, defeating body shot does not itself apply knockback', () => {
    let wave = createWave(OPTIONS)
    wave = tick(wave, 500, CONFIG)
    wave = applyHit(wave, 'a', 'body', NO_COOLDOWN) // -> 0.4
    wave = applyHit(wave, 'a', 'body', NO_COOLDOWN) // -> 0.3
    const beforeFinal = wave.carriers.find((c) => c.id === 'a')!.distance
    wave = applyHit(wave, 'a', 'body', NO_COOLDOWN) // defeats it
    const carrier = wave.carriers.find((c) => c.id === 'a')!
    expect(carrier.status).toBe('defeated')
    expect(carrier.distance).toBeCloseTo(beforeFinal)
  })

  it('a non-final wrong body hit still counts toward wrong-shot telemetry alongside the knockback', () => {
    const wave = applyHit(createWave(OPTIONS), 'a', 'body', NO_COOLDOWN)
    expect(wave.wrongShots).toBe(1)
    expect(wave.carriers.find((c) => c.id === 'a')!.distance).toBe(SPAWN_BOUNDARY_DISTANCE)
  })

  it('forward approach is paused while the reaction lock is active, then resumes from the knocked-back position', () => {
    let wave = createWave(OPTIONS)
    wave = tick(wave, 500, CONFIG) // distance 0.5
    wave = applyHit(wave, 'a', 'body', NO_COOLDOWN) // -> 0.4, locked until elapsedMs + HIT_REACTION_LOCK_MS
    const knockedBackDistance = wave.carriers.find((c) => c.id === 'a')!.distance
    expect(knockedBackDistance).toBeCloseTo(0.4)

    // Mid-lock: still ticking, but the hit carrier must not have moved —
    // neither forward nor snapped back to its pre-hit 0.5.
    wave = tick(wave, HIT_REACTION_LOCK_MS / 2, CONFIG)
    const midLock = wave.carriers.find((c) => c.id === 'a')!
    expect(midLock.distance).toBeCloseTo(knockedBackDistance)
    expect(midLock.distance).not.toBeCloseTo(0.5)

    // Past the lock: resumes advancing from the knocked-back distance, not
    // from the original pre-hit distance.
    wave = tick(wave, HIT_REACTION_LOCK_MS, CONFIG)
    const resumed = wave.carriers.find((c) => c.id === 'a')!
    expect(resumed.distance).toBeGreaterThan(knockedBackDistance)
    expect(resumed.reactionLockUntilMs).toBeNull()

    // Other carriers were never locked and kept advancing normally the
    // whole time — independent per-carrier state.
    const untouched = wave.carriers.find((c) => c.id === 'b')!
    expect(untouched.distance).toBeGreaterThan(resumed.distance)
  })

  it('a resolved wave cannot have its carriers moved by a further body shot', () => {
    let wave = createWave(OPTIONS)
    wave = tick(wave, 500, CONFIG)
    wave = applyHit(wave, 'b', 'head', NO_COOLDOWN) // solves the wave
    const resolved = wave
    wave = applyHit(wave, 'a', 'body', NO_COOLDOWN)
    expect(wave).toBe(resolved)
    expect(wave.carriers.find((c) => c.id === 'a')!.distance).toBeCloseTo(0.5)
  })
})

describe('correct-carrier resolution', () => {
  it('correct headshot maps to the headshot resolution', () => {
    const wave = applyHit(createWave(OPTIONS), 'b', 'head', NO_COOLDOWN)
    expect(wave.outcome).toBe('solved')
    expect(wave.resolutionReason).toBe('correct_headshot')
    expect(wave.resolvingCarrierId).toBe('b')
  })

  it('correct third body shot maps to the body-shot resolution', () => {
    const wave = threeBodyShots(createWave(OPTIONS), 'b')
    expect(wave.outcome).toBe('solved')
    expect(wave.resolutionReason).toBe('correct_body')
    expect(wave.resolvingCarrierId).toBe('b')
  })

  it('a non-final body hit on the correct carrier does not resolve the wave or count as a wrong shot', () => {
    const wave = applyHit(createWave(OPTIONS), 'b', 'body', NO_COOLDOWN)
    expect(wave.outcome).toBe('pending')
    expect(wave.wrongShots).toBe(0)
    expect(wave.lastHit).toEqual({ carrierId: 'b', zone: 'body', defeated: false })
  })

  it('correct-carrier defeat resolves exactly once even if applyHit is called again', () => {
    let wave = applyHit(createWave(OPTIONS), 'b', 'head', NO_COOLDOWN)
    const resolved = wave
    wave = applyHit(wave, 'a', 'head', NO_COOLDOWN)
    expect(wave).toBe(resolved)
  })
})

describe('incorrect-carrier behavior', () => {
  it('every accepted wrong-target hit increments wrong-shot telemetry, including non-final body hits', () => {
    let wave = createWave(OPTIONS)
    wave = applyHit(wave, 'a', 'body', NO_COOLDOWN)
    expect(wave.wrongShots).toBe(1)
    wave = applyHit(wave, 'c', 'body', NO_COOLDOWN)
    expect(wave.wrongShots).toBe(2)
  })

  it('non-final wrong body hits do not accelerate the wave or end it', () => {
    const wave = applyHit(createWave(OPTIONS), 'a', 'body', NO_COOLDOWN)
    expect(wave.speedMultiplier).toBe(1)
    expect(wave.outcome).toBe('pending')
  })

  it('first wrong-carrier defeat accelerates survivors', () => {
    const wave = threeBodyShots(createWave(OPTIONS), 'a')
    expect(wave.speedMultiplier).toBeCloseTo(1.18)
    expect(wave.wrongCarriersDefeated).toBe(1)
  })

  it('first wrong-carrier defeat does not end the wave', () => {
    const wave = threeBodyShots(createWave(OPTIONS), 'a')
    expect(wave.outcome).toBe('pending')
  })

  it('second wrong-carrier defeat resolves the wave as a life loss', () => {
    let wave = threeBodyShots(createWave(OPTIONS), 'a')
    wave = threeBodyShots(wave, 'c')
    expect(wave.outcome).toBe('life_lost')
    expect(wave.resolutionReason).toBe('second_wrong_defeated')
    expect(wave.resolvingCarrierId).toBe('c')
  })

  it('speed only compounds once per wrong-carrier defeat, not per wrong hit', () => {
    let wave = createWave(OPTIONS)
    wave = applyHit(wave, 'a', 'body', NO_COOLDOWN) // non-final, no boost
    wave = applyHit(wave, 'a', 'body', NO_COOLDOWN) // non-final, no boost
    expect(wave.speedMultiplier).toBe(1)
    wave = applyHit(wave, 'a', 'body', NO_COOLDOWN) // defeats 'a', boost applies once
    expect(wave.speedMultiplier).toBeCloseTo(1.18)
  })

  it('wrong-carrier defeat count resets for the next wave', () => {
    let wave = threeBodyShots(createWave(OPTIONS), 'a')
    expect(wave.wrongCarriersDefeated).toBe(1)
    const nextWave = createWave(OPTIONS)
    expect(nextWave.wrongCarriersDefeated).toBe(0)
  })

  it('no shots mutate a resolved wave (second-wrong-defeat life loss)', () => {
    let wave = threeBodyShots(createWave(OPTIONS), 'a')
    wave = threeBodyShots(wave, 'c')
    const resolved = wave
    wave = applyHit(wave, 'b', 'head', NO_COOLDOWN)
    expect(wave).toBe(resolved)
  })
})

describe('tick / approach / player contact', () => {
  it('advances alive carriers proportionally to dt/approachMs', () => {
    const wave = createWave(OPTIONS)
    const next = tick(wave, 250, CONFIG)
    for (const carrier of next.carriers) {
      expect(carrier.distance).toBeCloseTo(0.25)
    }
    expect(next.elapsedMs).toBe(250)
    expect(next.outcome).toBe('pending')
  })

  it('scales the advance by the current speed multiplier', () => {
    let wave = threeBodyShots(createWave(OPTIONS), 'a') // speedMultiplier -> 1.18
    const next = tick(wave, 200, CONFIG)
    for (const carrier of next.carriers) {
      if (carrier.status !== 'active') continue
      expect(carrier.distance).toBeCloseTo((200 / 1000) * 1.18)
    }
  })

  it('marks the first carrier to reach the danger line as player contact and resolves the wave', () => {
    const wave = createWave(OPTIONS)
    const next = tick(wave, 1000, CONFIG)
    expect(next.outcome).toBe('life_lost')
    expect(next.resolutionReason).toBe('player_contact')
    expect(next.resolvingCarrierId).not.toBeNull()
  })

  it('multiple carriers reaching the boundary in the same tick still resolve as exactly one contact', () => {
    const wave = createWave(OPTIONS)
    const next = tick(wave, 5000, CONFIG) // all four would cross in one giant step
    const reachedCount = next.carriers.filter((c) => c.status === 'reached_player').length
    expect(reachedCount).toBe(4) // all visually arrive...
    expect(next.outcome).toBe('life_lost') // ...but only one resolution
    expect(next.resolutionReason).toBe('player_contact')
  })

  it('player contact resolves exactly once — a further tick is a no-op', () => {
    let wave = tick(createWave(OPTIONS), 1000, CONFIG)
    const resolved = wave
    wave = tick(wave, 500, CONFIG)
    expect(wave).toBe(resolved)
  })

  it('does not advance carriers that are already defeated', () => {
    let wave = applyHit(createWave(OPTIONS), 'a', 'head', NO_COOLDOWN)
    wave = tick(wave, 1000, CONFIG)
    const a = wave.carriers.find((c) => c.id === 'a')!
    expect(a.status).toBe('defeated')
    expect(a.distance).toBe(0)
  })

  it('no ticks mutate a resolved wave', () => {
    let wave = applyHit(createWave(OPTIONS), 'b', 'head', NO_COOLDOWN)
    const resolved = wave
    wave = tick(wave, 1000, CONFIG)
    expect(wave).toBe(resolved)
  })
})

describe('background misses', () => {
  it('do not affect telemetry, damage, or speed', () => {
    const wave = createWave(OPTIONS)
    const next = registerMiss(wave, CONFIG)
    expect(next.wrongShots).toBe(0)
    expect(next.speedMultiplier).toBe(1)
    expect(next.carriers).toEqual(wave.carriers)
    expect(next.outcome).toBe('pending')
  })

  it('respect the shot cooldown', () => {
    let wave = registerMiss(createWave(OPTIONS), CONFIG)
    const afterFirst = wave
    wave = registerMiss(wave, CONFIG) // immediately again, same elapsedMs
    expect(wave).toBe(afterFirst)
  })

  it('do not themselves block a later real hit once cooldown clears', () => {
    let wave = registerMiss(createWave(OPTIONS), CONFIG)
    wave = tick(wave, 150, CONFIG)
    wave = applyHit(wave, 'b', 'head', CONFIG)
    expect(wave.outcome).toBe('solved')
  })
})

describe('cooldown', () => {
  it('rejects a hit fired too soon after a previous hit', () => {
    let wave = applyHit(createWave(OPTIONS), 'a', 'body', CONFIG)
    const afterFirst = wave
    wave = applyHit(wave, 'c', 'body', CONFIG) // same elapsedMs, within cooldown
    expect(wave).toBe(afterFirst)
  })

  it('allows a hit once the cooldown has elapsed', () => {
    let wave = applyHit(createWave(OPTIONS), 'a', 'body', CONFIG)
    wave = tick(wave, 150, CONFIG)
    wave = applyHit(wave, 'c', 'body', CONFIG)
    expect(wave.carriers.find((c) => c.id === 'c')!.bodyHits).toBe(1)
  })
})

describe('canShoot', () => {
  it('is false once the wave is resolved', () => {
    const wave = applyHit(createWave(OPTIONS), 'b', 'head', NO_COOLDOWN)
    expect(canShoot(wave, CONFIG)).toBe(false)
  })

  it('is true immediately on a fresh wave', () => {
    expect(canShoot(createWave(OPTIONS), CONFIG)).toBe(true)
  })
})
