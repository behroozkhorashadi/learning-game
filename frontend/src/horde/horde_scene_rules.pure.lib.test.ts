import { describe, expect, it } from 'vitest'
import { createRound, type HordeZombie, type Posture } from './horde_engine.pure.lib.ts'
import { blastProgress, clipRoleFor, healthFraction, isDrawn, projectilePosition, secondsLeft, slotColor, zoneAlongBody } from './horde_scene_rules.pure.lib.ts'

const ZOMBIE: HordeZombie = createRound({ seed: 1, lives: 3, grenades: 0, shoves: 3, ammo: 0, cover: [] }).zombies[0] ?? (() => { throw new Error('no zombie') })()

function posed(posture: Posture, change: Partial<HordeZombie> = {}): HordeZombie {
  return { ...ZOMBIE, posture, ...change }
}

describe('horde scene rules', () => {
  it('plays an animation for every posture', () => {
    expect(clipRoleFor(posed('advancing'))).toBe('walk')
    expect(clipRoleFor(posed('hiding'))).toBe('idle')
    expect(clipRoleFor(posed('staggered'))).toBe('hitReact')
    expect(clipRoleFor(posed('dodging'))).toBe('dodge')
    expect(clipRoleFor(posed('throwing'))).toBe('reach')
    expect(clipRoleFor(posed('attacking'))).toBe('reach')
    expect(clipRoleFor(posed('downed'))).toBe('knockedDown')
    expect(clipRoleFor(posed('rising'))).toBe('getUp')
    expect(clipRoleFor(posed('dead', { defeatedBy: 'head' }))).toBe('deadHeadshot')
    expect(clipRoleFor(posed('dead', { defeatedBy: 'leg' }))).toBe('deadBody')
  })

  it('draws everything but a zombie that has left', () => {
    expect(isDrawn(posed('dead'))).toBe(true)
    expect(isDrawn(posed('gone'))).toBe(false)
  })

  it('health is a fraction of full', () => {
    expect(healthFraction(posed('advancing', { health: 50 }))).toBe(0.5)
    expect(healthFraction(posed('advancing', { health: -5 }))).toBe(0)
  })

  it('splits head, body, and leg along the body, standing or lying', () => {
    // Standing: head bone at 1.6, hips at 1.0.
    expect(zoneAlongBody([0, 1.8, 0], [0, 1.6, 0], [0, 1, 0])).toBe('head')
    expect(zoneAlongBody([0, 1.3, 0], [0, 1.6, 0], [0, 1, 0])).toBe('body')
    expect(zoneAlongBody([0, 0.4, 0], [0, 1.6, 0], [0, 1, 0])).toBe('leg')
    // The waist, just below the hips bone, is still body.
    expect(zoneAlongBody([0, 0.9, 0], [0, 1.6, 0], [0, 1, 0])).toBe('body')
    // Lying along z: head at z=-1, hips at z=0; height no longer decides.
    expect(zoneAlongBody([0, 0.2, -1.2], [0, 0.2, -1], [0, 0.2, 0])).toBe('head')
    expect(zoneAlongBody([0, 0.2, 0.8], [0, 0.2, -1], [0, 0.2, 0])).toBe('leg')
    expect(zoneAlongBody([0, 1, 0], [0, 1, 0], [0, 1, 0])).toBe('body')
  })

  it('lobs a thrown object from the thrower to just in front of the camera', () => {
    const projectile = { id: 'p', fromX: 2, fromDepth: 10, launchedAtMs: 0, landsAtMs: 1000 }
    const [sx, , sz] = projectilePosition(projectile, 0)
    expect([sx, sz]).toEqual([2, -10])
    const middle = projectilePosition(projectile, 500)
    const end = projectilePosition(projectile, 1000)
    expect(middle[1]).toBeGreaterThan(end[1])
    expect(end[2]).toBeGreaterThan(0)
  })

  it('a blast grows and fades', () => {
    const blast = { id: 'b', x: 0, depth: 5, atMs: 100, dud: false }
    expect(blastProgress(blast, 100)).toEqual({ grow: 0, fade: 1 })
    expect(blastProgress(blast, 10_000)).toEqual({ grow: 1, fade: 0 })
  })

  it('counts whole seconds down, never below zero', () => {
    expect(secondsLeft(0, 60_000)).toBe(60)
    expect(secondsLeft(100, 60_000)).toBe(60)
    expect(secondsLeft(59_500, 60_000)).toBe(1)
    expect(secondsLeft(70_000, 60_000)).toBe(0)
  })

  it('colours the four slots differently', () => {
    expect(new Set([0, 1, 2, 3].map(slotColor)).size).toBe(4)
    expect(slotColor(4)).toBe(slotColor(0))
  })
})
