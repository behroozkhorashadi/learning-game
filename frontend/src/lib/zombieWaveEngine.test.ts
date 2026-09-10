import { describe, it, expect } from 'vitest'
import { createWave, tick, applyHit, registerMiss, canShoot, type CarrierOption, type WaveConfig } from './zombieWaveEngine'

const OPTIONS: CarrierOption[] = [
  { id: 'a', value: 6, correct: false },
  { id: 'b', value: 7, correct: true },
  { id: 'c', value: 8, correct: false },
  { id: 'd', value: 5, correct: false },
]

const CONFIG: WaveConfig = { approachMs: 1000, wrongHitSpeedBoost: 0.18, shotCooldownMs: 100 }
const NO_COOLDOWN: WaveConfig = { ...CONFIG, shotCooldownMs: 0 }

describe('createWave', () => {
  it('starts every carrier active, undefeated, at distance 0, in a pending wave', () => {
    const wave = createWave(OPTIONS)
    expect(wave.outcome).toBe('pending')
    expect(wave.speedMultiplier).toBe(1)
    expect(wave.wrongCarriersDefeated).toBe(0)
    expect(wave.carriers).toHaveLength(4)
    for (const carrier of wave.carriers) {
      expect(carrier.status).toBe('active')
      expect(carrier.distance).toBe(0)
      expect(carrier.defeatedBy).toBeNull()
    }
  })
})

describe('one-shot defeat (identical for correct and incorrect carriers)', () => {
  it('one body shot immediately defeats a carrier', () => {
    const wave = applyHit(createWave(OPTIONS), 'a', 'body', NO_COOLDOWN)
    const carrier = wave.carriers.find((c) => c.id === 'a')!
    expect(carrier.status).toBe('defeated')
    expect(carrier.defeatedBy).toBe('body')
  })

  it('one headshot immediately defeats a carrier', () => {
    const wave = applyHit(createWave(OPTIONS), 'a', 'head', NO_COOLDOWN)
    const carrier = wave.carriers.find((c) => c.id === 'a')!
    expect(carrier.status).toBe('defeated')
    expect(carrier.defeatedBy).toBe('headshot')
  })

  it('headshot and body-shot outcomes remain distinguishable via defeatedBy', () => {
    const headshotWave = applyHit(createWave(OPTIONS), 'a', 'head', NO_COOLDOWN)
    const bodyShotWave = applyHit(createWave(OPTIONS), 'c', 'body', NO_COOLDOWN)
    expect(headshotWave.carriers.find((c) => c.id === 'a')!.defeatedBy).toBe('headshot')
    expect(bodyShotWave.carriers.find((c) => c.id === 'c')!.defeatedBy).toBe('body')
  })

  it('a defeated carrier cannot be hit again', () => {
    let wave = applyHit(createWave(OPTIONS), 'a', 'body', NO_COOLDOWN)
    const afterDefeat = wave
    wave = applyHit(wave, 'a', 'head', NO_COOLDOWN)
    expect(wave).toBe(afterDefeat)
  })

  it('a carrier that has reached the player cannot be hit', () => {
    const reached = tick(createWave(OPTIONS), 1000, CONFIG)
    const after = applyHit(reached, reached.resolvingCarrierId!, 'head', NO_COOLDOWN)
    expect(after).toBe(reached)
  })
})

describe('lastHit — the discrete per-shot event', () => {
  it('records carrierId, zone, and whether the target was correct', () => {
    const wave = applyHit(createWave(OPTIONS), 'a', 'body', NO_COOLDOWN)
    expect(wave.lastHit).toEqual({ carrierId: 'a', zone: 'body', correct: false })
  })

  it('records correct: true for the correct carrier', () => {
    const wave = applyHit(createWave(OPTIONS), 'b', 'head', NO_COOLDOWN)
    expect(wave.lastHit).toEqual({ carrierId: 'b', zone: 'head', correct: true })
  })

  it('is cleared back to null on the very next tick, so it never stays "on"', () => {
    let wave = applyHit(createWave(OPTIONS), 'a', 'body', NO_COOLDOWN)
    expect(wave.lastHit).not.toBeNull()
    wave = tick(wave, 16, CONFIG)
    expect(wave.lastHit).toBeNull()
  })

  it('a background miss never sets lastHit', () => {
    const wave = registerMiss(createWave(OPTIONS), CONFIG)
    expect(wave.lastHit).toBeNull()
  })

  it('a no-op hit (cooldown, already resolved, already defeated) does not touch lastHit', () => {
    let wave = applyHit(createWave(OPTIONS), 'a', 'body', NO_COOLDOWN)
    const afterFirst = wave
    wave = applyHit(wave, 'a', 'head', NO_COOLDOWN) // already defeated — no-op
    expect(wave).toBe(afterFirst)
    expect(wave.lastHit).toEqual({ carrierId: 'a', zone: 'body', correct: false })
  })
})

describe('correct-carrier resolution', () => {
  it('a correct headshot solves the wave with the headshot reason', () => {
    const wave = applyHit(createWave(OPTIONS), 'b', 'head', NO_COOLDOWN)
    expect(wave.outcome).toBe('solved')
    expect(wave.resolutionReason).toBe('correct_headshot')
    expect(wave.resolvingCarrierId).toBe('b')
  })

  it('a correct body shot solves the wave with the body reason', () => {
    const wave = applyHit(createWave(OPTIONS), 'b', 'body', NO_COOLDOWN)
    expect(wave.outcome).toBe('solved')
    expect(wave.resolutionReason).toBe('correct_body')
    expect(wave.resolvingCarrierId).toBe('b')
  })

  it('correct-carrier defeat resolves exactly once even if applyHit is called again', () => {
    let wave = applyHit(createWave(OPTIONS), 'b', 'head', NO_COOLDOWN)
    const resolved = wave
    wave = applyHit(wave, 'a', 'head', NO_COOLDOWN)
    expect(wave).toBe(resolved)
  })
})

describe('incorrect-carrier behavior', () => {
  it('every accepted wrong-target hit increments wrong-shot telemetry', () => {
    let wave = createWave(OPTIONS)
    wave = applyHit(wave, 'a', 'body', NO_COOLDOWN)
    expect(wave.wrongShots).toBe(1)
  })

  it('first wrong-carrier defeat accelerates surviving zombies', () => {
    const wave = applyHit(createWave(OPTIONS), 'a', 'body', NO_COOLDOWN)
    expect(wave.speedMultiplier).toBeCloseTo(1.18)
    expect(wave.wrongCarriersDefeated).toBe(1)
  })

  it('first wrong-carrier defeat does not end the wave', () => {
    const wave = applyHit(createWave(OPTIONS), 'a', 'body', NO_COOLDOWN)
    expect(wave.outcome).toBe('pending')
  })

  it('second wrong-carrier defeat resolves the wave as a life loss', () => {
    let wave = applyHit(createWave(OPTIONS), 'a', 'body', NO_COOLDOWN)
    wave = applyHit(wave, 'c', 'head', NO_COOLDOWN)
    expect(wave.outcome).toBe('life_lost')
    expect(wave.resolutionReason).toBe('second_wrong_defeated')
    expect(wave.resolvingCarrierId).toBe('c')
  })

  it('the second wrong-carrier defeat does not apply another speed boost — the wave ends instead', () => {
    let wave = applyHit(createWave(OPTIONS), 'a', 'body', NO_COOLDOWN)
    const speedAfterFirst = wave.speedMultiplier
    wave = applyHit(wave, 'c', 'head', NO_COOLDOWN)
    expect(wave.speedMultiplier).toBe(speedAfterFirst)
    expect(wave.outcome).toBe('life_lost')
  })

  it('wrong-carrier defeat count resets for the next wave', () => {
    const wave = applyHit(createWave(OPTIONS), 'a', 'body', NO_COOLDOWN)
    expect(wave.wrongCarriersDefeated).toBe(1)
    const nextWave = createWave(OPTIONS)
    expect(nextWave.wrongCarriersDefeated).toBe(0)
  })

  it('no shots mutate a resolved wave (second-wrong-defeat life loss)', () => {
    let wave = applyHit(createWave(OPTIONS), 'a', 'body', NO_COOLDOWN)
    wave = applyHit(wave, 'c', 'head', NO_COOLDOWN)
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
    let wave = applyHit(createWave(OPTIONS), 'a', 'body', NO_COOLDOWN) // speedMultiplier -> 1.18
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
    expect(wave.carriers.find((c) => c.id === 'c')!.status).toBe('defeated')
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
