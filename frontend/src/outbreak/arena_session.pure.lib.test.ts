import { describe, expect, it } from 'vitest'
import { aimFromPointer, arenaDebugFrom, type ArenaPhase, buildWaveConfig, containerAnimation, formatResponseTime, isGamePhase, isRoundInProgress, summarizeResults } from './arena_session.pure.lib.ts'

describe('arenaDebugFrom (the production guard for the dev views)', () => {
  it('is all off outside dev mode even when the query asks for it', () => {
    expect(arenaDebugFrom(false, '?tuneWeapon=1&debugLanes=1')).toEqual({ lanes: false, weaponTuning: false })
    expect(arenaDebugFrom(false, '?screen=equation-outbreak-live&tuneWeapon=1')).toEqual({ lanes: false, weaponTuning: false })
  })

  it('is off in dev mode without the query param: never on by default', () => {
    expect(arenaDebugFrom(true, '')).toEqual({ lanes: false, weaponTuning: false })
    expect(arenaDebugFrom(true, '?screen=equation-outbreak-live')).toEqual({ lanes: false, weaponTuning: false })
  })

  it('turns each view on only with dev mode and its exact query param', () => {
    expect(arenaDebugFrom(true, '?tuneWeapon=1')).toEqual({ lanes: false, weaponTuning: true })
    expect(arenaDebugFrom(true, '?screen=equation-outbreak-live&debugLanes=1')).toEqual({ lanes: true, weaponTuning: false })
  })

  it('rejects a near-miss value rather than any truthy-looking string', () => {
    expect(arenaDebugFrom(true, '?tuneWeapon=true').weaponTuning).toBe(false)
    expect(arenaDebugFrom(true, '?tuneWeapon=0').weaponTuning).toBe(false)
  })
})

describe('containerAnimation', () => {
  it('shakes hard on impact, briefly on a wrong hit, and never with reduced motion', () => {
    expect(containerAnimation('impact', null, false)).toBe('screenShake 600ms ease-out')
    expect(containerAnimation('playing', { kind: 'wrongHit', id: 1 }, false)).toBe('wrongHitShake 220ms ease-out')
    expect(containerAnimation('playing', { kind: 'correctHit', id: 1 }, false)).toBe('none')
    expect(containerAnimation('impact', { kind: 'wrongHit', id: 1 }, true)).toBe('none')
  })
})

describe('phases', () => {
  it('a round is in progress from intro to impact, and the 3D view hides while the next question loads', () => {
    const idle: readonly ArenaPhase[] = ['start', 'complete', 'game_over']
    expect(idle.map(isRoundInProgress)).toEqual([false, false, false])
    expect(isRoundInProgress('transitioning_to_next_wave')).toBe(true)
    expect(isGamePhase('transitioning_to_next_wave')).toBe(false)
    expect(isGamePhase('life_lost_frozen')).toBe(true)
  })
})

describe('results', () => {
  it('summarizes correct answers and average time, and formats seconds', () => {
    const results = [
      { question: 'a', correct: true, timeTakenMs: 1000 },
      { question: 'b', correct: false, timeTakenMs: 3000 },
    ]
    expect(summarizeResults(results)).toEqual({ correctCount: 1, averageMs: 2000 })
    expect(summarizeResults([])).toEqual({ correctCount: 0, averageMs: 0 })
    expect(formatResponseTime(2345)).toBe('2.3s')
  })
})

describe('aimFromPointer', () => {
  it('maps the play area to -1..1 with y up', () => {
    const rect = { left: 100, top: 50, width: 200, height: 100 }
    expect(aimFromPointer(100, 50, rect)).toEqual({ x: -1, y: 1 })
    expect(aimFromPointer(200, 100, rect)).toEqual({ x: 0, y: -0 })
    expect(aimFromPointer(300, 150, rect)).toEqual({ x: 1, y: -1 })
  })
})

describe('buildWaveConfig', () => {
  it('carries the round approach time and the weapon cocking time', () => {
    expect(buildWaveConfig(6000, 900)).toEqual({ approachMs: 6000, wrongHitSpeedBoost: 0.18, cockingMs: 900 })
  })
})
