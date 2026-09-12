import { describe, it, expect } from 'vitest'
import { createWave, tick, applyHit, registerMiss, canShoot, type CarrierOption, type WaveConfig } from './zombieWaveEngine'

const OPTIONS: CarrierOption[] = [
  { id: 'a', label: '6', correct: false },
  { id: 'b', label: '7', correct: true },
  { id: 'c', label: '8', correct: false },
  { id: 'd', label: '5', correct: false },
]

// approachMs is deliberately much larger than cockingMs so that
// fast-forwarding through the cocking window (tick(wave, CONFIG.cockingMs))
// never itself advances a carrier all the way to the danger line — the one
// test that *wants* contact during cocking ticks by far more than either.
const CONFIG: WaveConfig = { approachMs: 10000, wrongHitSpeedBoost: 0.18, cockingMs: 900 }

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

  it('starts every wave with exactly two shots, ready to fire', () => {
    const wave = createWave(OPTIONS)
    expect(wave.shotsRemaining).toBe(2)
    expect(wave.weaponPhase).toBe('readyFirstShot')
    expect(wave.cockingUntilMs).toBeNull()
    expect(canShoot(wave, CONFIG)).toBe(true)
  })
})

describe('first shot — correct', () => {
  it('a correct headshot solves the wave immediately, no cocking', () => {
    const wave = applyHit(createWave(OPTIONS), 'b', 'head', CONFIG)
    expect(wave.outcome).toBe('solved')
    expect(wave.resolutionReason).toBe('correct_headshot')
    expect(wave.resolvingCarrierId).toBe('b')
    expect(wave.weaponPhase).toBe('waveResolved')
    expect(wave.shotsRemaining).toBe(1)
    expect(wave.cockingUntilMs).toBeNull()
  })

  it('a correct body shot solves the wave immediately, no cocking', () => {
    const wave = applyHit(createWave(OPTIONS), 'b', 'body', CONFIG)
    expect(wave.outcome).toBe('solved')
    expect(wave.resolutionReason).toBe('correct_body')
    expect(wave.weaponPhase).toBe('waveResolved')
  })

  it('headshot and body-shot outcomes remain distinguishable via defeatedBy and lastHit.zone', () => {
    const headshotWave = applyHit(createWave(OPTIONS), 'b', 'head', CONFIG)
    expect(headshotWave.carriers.find((c) => c.id === 'b')!.defeatedBy).toBe('headshot')
    expect(headshotWave.lastHit).toEqual({ carrierId: 'b', zone: 'head', correct: true })

    const bodyWave = applyHit(createWave(OPTIONS), 'b', 'body', CONFIG)
    expect(bodyWave.carriers.find((c) => c.id === 'b')!.defeatedBy).toBe('body')
    expect(bodyWave.lastHit).toEqual({ carrierId: 'b', zone: 'body', correct: true })
  })
})

describe('first shot — wrong target', () => {
  it('defeats the wrong carrier immediately, with the same one-shot rule as any other', () => {
    const wave = applyHit(createWave(OPTIONS), 'a', 'body', CONFIG)
    expect(wave.carriers.find((c) => c.id === 'a')!.status).toBe('defeated')
    expect(wave.outcome).toBe('pending')
  })

  it('speeds up surviving zombies', () => {
    const wave = applyHit(createWave(OPTIONS), 'a', 'body', CONFIG)
    expect(wave.speedMultiplier).toBeCloseTo(1.18)
  })

  it('begins cocking, leaving one shot remaining', () => {
    const wave = applyHit(createWave(OPTIONS), 'a', 'head', CONFIG)
    expect(wave.weaponPhase).toBe('cocking')
    expect(wave.shotsRemaining).toBe(1)
    expect(wave.cockingUntilMs).toBe(CONFIG.cockingMs)
  })

  it('increments wrong-shot telemetry', () => {
    const wave = applyHit(createWave(OPTIONS), 'a', 'body', CONFIG)
    expect(wave.wrongShots).toBe(1)
  })
})

describe('first shot — miss', () => {
  it('consumes the shot, defeats nothing, and begins cocking without speeding zombies', () => {
    const wave = registerMiss(createWave(OPTIONS), CONFIG)
    expect(wave.shotsRemaining).toBe(1)
    expect(wave.weaponPhase).toBe('cocking')
    expect(wave.speedMultiplier).toBe(1)
    expect(wave.wrongShots).toBe(0)
    expect(wave.outcome).toBe('pending')
    for (const carrier of wave.carriers) expect(carrier.status).toBe('active')
  })

  it('does not set lastHit', () => {
    const wave = registerMiss(createWave(OPTIONS), CONFIG)
    expect(wave.lastHit).toBeNull()
  })
})

describe('cocking', () => {
  it('rejects a hit while cocking', () => {
    let wave = applyHit(createWave(OPTIONS), 'a', 'body', CONFIG) // -> cocking
    const cocking = wave
    wave = applyHit(wave, 'c', 'head', CONFIG)
    expect(wave).toBe(cocking)
  })

  it('rejects a miss while cocking', () => {
    let wave = applyHit(createWave(OPTIONS), 'a', 'body', CONFIG)
    const cocking = wave
    wave = registerMiss(wave, CONFIG)
    expect(wave).toBe(cocking)
  })

  it('a click during cocking is not queued — cocking still ends at its own scheduled time, unaffected', () => {
    let wave = applyHit(createWave(OPTIONS), 'a', 'body', CONFIG)
    wave = applyHit(wave, 'c', 'head', CONFIG) // ignored
    wave = applyHit(wave, 'd', 'head', CONFIG) // ignored
    wave = tick(wave, CONFIG.cockingMs, CONFIG)
    expect(wave.weaponPhase).toBe('readySecondShot')
    // Neither ignored click did anything — c and d are still active.
    expect(wave.carriers.find((carrier) => carrier.id === 'c')!.status).toBe('active')
    expect(wave.carriers.find((carrier) => carrier.id === 'd')!.status).toBe('active')
  })

  it('canShoot is false throughout the cocking window', () => {
    const wave = applyHit(createWave(OPTIONS), 'a', 'body', CONFIG)
    expect(canShoot(wave, CONFIG)).toBe(false)
  })

  it('promotes to readySecondShot once cockingMs has elapsed', () => {
    let wave = applyHit(createWave(OPTIONS), 'a', 'body', CONFIG)
    wave = tick(wave, CONFIG.cockingMs, CONFIG)
    expect(wave.weaponPhase).toBe('readySecondShot')
    expect(wave.cockingUntilMs).toBeNull()
    expect(canShoot(wave, CONFIG)).toBe(true)
  })

  it('does not promote before cockingMs has elapsed', () => {
    let wave = applyHit(createWave(OPTIONS), 'a', 'body', CONFIG)
    wave = tick(wave, CONFIG.cockingMs - 50, CONFIG)
    expect(wave.weaponPhase).toBe('cocking')
    expect(canShoot(wave, CONFIG)).toBe(false)
  })

  it('a zombie reaching the player during cocking cancels the sequence and resolves as player contact', () => {
    let wave = applyHit(createWave(OPTIONS), 'a', 'body', CONFIG) // -> cocking, speedMultiplier 1.18
    wave = tick(wave, 10000, CONFIG) // far more than enough to reach the danger line even mid-cock
    expect(wave.outcome).toBe('life_lost')
    expect(wave.resolutionReason).toBe('player_contact')
    expect(wave.weaponPhase).toBe('waveResolved')
    expect(canShoot(wave, CONFIG)).toBe(false)
  })
})

describe('second shot — correct', () => {
  function readyForSecondShot(): ReturnType<typeof createWave> {
    let wave = applyHit(createWave(OPTIONS), 'a', 'body', CONFIG) // wrong first shot
    wave = tick(wave, CONFIG.cockingMs, CONFIG)
    return wave
  }

  it('solves the wave, preserving headshot classification', () => {
    const wave = applyHit(readyForSecondShot(), 'b', 'head', CONFIG)
    expect(wave.outcome).toBe('solved')
    expect(wave.resolutionReason).toBe('correct_headshot')
    expect(wave.shotsRemaining).toBe(0)
  })

  it('solves the wave, preserving body-shot classification', () => {
    const wave = applyHit(readyForSecondShot(), 'b', 'body', CONFIG)
    expect(wave.outcome).toBe('solved')
    expect(wave.resolutionReason).toBe('correct_body')
  })
})

describe('second shot — wrong target', () => {
  function readyForSecondShot(): ReturnType<typeof createWave> {
    let wave = applyHit(createWave(OPTIONS), 'a', 'body', CONFIG)
    wave = tick(wave, CONFIG.cockingMs, CONFIG)
    return wave
  }

  it('defeats the wrong carrier and ends the wave as a life loss', () => {
    const wave = applyHit(readyForSecondShot(), 'c', 'head', CONFIG)
    expect(wave.carriers.find((carrier) => carrier.id === 'c')!.status).toBe('defeated')
    expect(wave.outcome).toBe('life_lost')
    expect(wave.resolutionReason).toBe('second_wrong_defeated')
    expect(wave.shotsRemaining).toBe(0)
  })

  it('still increments wrong-shot telemetry for the final shot', () => {
    const wave = applyHit(readyForSecondShot(), 'c', 'head', CONFIG)
    expect(wave.wrongShots).toBe(2)
  })

  it('does not apply a second speed boost', () => {
    const first = applyHit(createWave(OPTIONS), 'a', 'body', CONFIG)
    const cocked = tick(first, CONFIG.cockingMs, CONFIG)
    const wave = applyHit(cocked, 'c', 'head', CONFIG)
    expect(wave.speedMultiplier).toBe(first.speedMultiplier)
  })
})

describe('second shot — miss', () => {
  function readyForSecondShot(): ReturnType<typeof createWave> {
    let wave = registerMiss(createWave(OPTIONS), CONFIG)
    wave = tick(wave, CONFIG.cockingMs, CONFIG)
    return wave
  }

  it('ends the wave as a life loss with no carrier to blame', () => {
    const wave = registerMiss(readyForSecondShot(), CONFIG)
    expect(wave.outcome).toBe('life_lost')
    expect(wave.resolutionReason).toBe('shots_exhausted')
    expect(wave.resolvingCarrierId).toBeNull()
    expect(wave.shotsRemaining).toBe(0)
  })

  it('does not set lastHit — no green or red feedback for a pure miss', () => {
    const wave = registerMiss(readyForSecondShot(), CONFIG)
    expect(wave.lastHit).toBeNull()
  })
})

describe('no third shot', () => {
  it('a resolved wave (solved) rejects any further hit', () => {
    const wave = applyHit(createWave(OPTIONS), 'b', 'head', CONFIG)
    const resolved = wave
    expect(applyHit(wave, 'a', 'head', CONFIG)).toBe(resolved)
  })

  it('a resolved wave (life lost after two shots) rejects any further hit', () => {
    let wave = applyHit(createWave(OPTIONS), 'a', 'body', CONFIG)
    wave = tick(wave, CONFIG.cockingMs, CONFIG)
    wave = applyHit(wave, 'c', 'head', CONFIG)
    const resolved = wave
    expect(applyHit(wave, 'd', 'head', CONFIG)).toBe(resolved)
    expect(registerMiss(wave, CONFIG)).toBe(resolved)
  })

  it('shotsRemaining never goes below zero', () => {
    let wave = applyHit(createWave(OPTIONS), 'a', 'body', CONFIG)
    wave = tick(wave, CONFIG.cockingMs, CONFIG)
    wave = applyHit(wave, 'c', 'head', CONFIG)
    expect(wave.shotsRemaining).toBe(0)
    wave = applyHit(wave, 'd', 'head', CONFIG)
    expect(wave.shotsRemaining).toBe(0)
  })
})

describe('defeated/reached carriers cannot be hit again', () => {
  it('a defeated carrier cannot be hit again', () => {
    let wave = applyHit(createWave(OPTIONS), 'a', 'body', CONFIG)
    wave = tick(wave, CONFIG.cockingMs, CONFIG)
    const afterCock = wave
    wave = applyHit(wave, 'a', 'head', CONFIG)
    expect(wave).toBe(afterCock)
  })

  it('a carrier that has reached the player cannot be hit', () => {
    const reached = tick(createWave(OPTIONS), 1000, CONFIG)
    const after = applyHit(reached, reached.resolvingCarrierId!, 'head', CONFIG)
    expect(after).toBe(reached)
  })
})

describe('lastHit is a one-tick pulse', () => {
  it('is cleared back to null on the very next tick', () => {
    let wave = applyHit(createWave(OPTIONS), 'a', 'body', CONFIG)
    expect(wave.lastHit).not.toBeNull()
    wave = tick(wave, 16, CONFIG)
    expect(wave.lastHit).toBeNull()
  })
})

describe('tick / approach / player contact', () => {
  // A much shorter approachMs than the shared CONFIG, so round dt values
  // produce clean distance fractions — cocking isn't exercised in this
  // block, so there's no risk of the interaction the module-level CONFIG
  // is deliberately tuned to avoid.
  const APPROACH_CONFIG: WaveConfig = { ...CONFIG, approachMs: 1000 }

  it('advances alive carriers proportionally to dt/approachMs', () => {
    const wave = createWave(OPTIONS)
    const next = tick(wave, 250, APPROACH_CONFIG)
    for (const carrier of next.carriers) {
      expect(carrier.distance).toBeCloseTo(0.25)
    }
    expect(next.elapsedMs).toBe(250)
    expect(next.outcome).toBe('pending')
  })

  it('scales the advance by the current speed multiplier', () => {
    const wave = applyHit(createWave(OPTIONS), 'a', 'body', APPROACH_CONFIG) // speedMultiplier -> 1.18
    const next = tick(wave, 200, APPROACH_CONFIG)
    for (const carrier of next.carriers) {
      if (carrier.status !== 'active') continue
      expect(carrier.distance).toBeCloseTo((200 / 1000) * 1.18)
    }
  })

  it('marks the first carrier to reach the danger line as player contact and resolves the wave', () => {
    const wave = createWave(OPTIONS)
    const next = tick(wave, 1000, APPROACH_CONFIG)
    expect(next.outcome).toBe('life_lost')
    expect(next.resolutionReason).toBe('player_contact')
    expect(next.resolvingCarrierId).not.toBeNull()
    expect(next.weaponPhase).toBe('waveResolved')
  })

  it('multiple carriers reaching the boundary in the same tick still resolve as exactly one contact', () => {
    const wave = createWave(OPTIONS)
    const next = tick(wave, 5000, APPROACH_CONFIG)
    const reachedCount = next.carriers.filter((c) => c.status === 'reached_player').length
    expect(reachedCount).toBe(4)
    expect(next.outcome).toBe('life_lost')
    expect(next.resolutionReason).toBe('player_contact')
  })

  it('player contact resolves exactly once — a further tick is a no-op', () => {
    let wave = tick(createWave(OPTIONS), 1000, APPROACH_CONFIG)
    const resolved = wave
    wave = tick(wave, 500, APPROACH_CONFIG)
    expect(wave).toBe(resolved)
  })

  it('does not advance carriers that are already defeated', () => {
    let wave = applyHit(createWave(OPTIONS), 'a', 'head', APPROACH_CONFIG)
    wave = tick(wave, 500, APPROACH_CONFIG)
    const a = wave.carriers.find((c) => c.id === 'a')!
    expect(a.status).toBe('defeated')
    expect(a.distance).toBe(0)
  })

  it('no ticks mutate a resolved wave', () => {
    let wave = applyHit(createWave(OPTIONS), 'b', 'head', APPROACH_CONFIG)
    const resolved = wave
    wave = tick(wave, 1000, APPROACH_CONFIG)
    expect(wave).toBe(resolved)
  })
})

describe('background misses (no accepted target)', () => {
  it('do not affect telemetry, damage, or speed', () => {
    const wave = createWave(OPTIONS)
    const next = registerMiss(wave, CONFIG)
    expect(next.wrongShots).toBe(0)
    expect(next.speedMultiplier).toBe(1)
    expect(next.carriers).toEqual(wave.carriers)
    expect(next.outcome).toBe('pending')
  })
})

describe('canShoot', () => {
  it('is false once the wave is resolved', () => {
    const wave = applyHit(createWave(OPTIONS), 'b', 'head', CONFIG)
    expect(canShoot(wave, CONFIG)).toBe(false)
  })

  it('is true immediately on a fresh wave', () => {
    expect(canShoot(createWave(OPTIONS), CONFIG)).toBe(true)
  })
})

describe('a new question restores two shots', () => {
  it('createWave always resets shotsRemaining and weaponPhase, regardless of the previous wave', () => {
    let previous = applyHit(createWave(OPTIONS), 'a', 'body', CONFIG)
    previous = tick(previous, CONFIG.cockingMs, CONFIG)
    previous = applyHit(previous, 'c', 'head', CONFIG)
    expect(previous.shotsRemaining).toBe(0)

    const next = createWave(OPTIONS)
    expect(next.shotsRemaining).toBe(2)
    expect(next.weaponPhase).toBe('readyFirstShot')
  })
})
