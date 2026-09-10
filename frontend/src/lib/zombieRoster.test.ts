import { describe, it, expect } from 'vitest'
import { selectSessionRoster, shuffle, type RandomFn } from './zombieRoster'
import type { CharacterDefinition } from './characterDefinitions'

function makeCharacter(id: string, enabled = true): CharacterDefinition {
  return {
    id,
    displayName: id,
    modelUrl: `/models/zombies/${id}.glb`,
    enabled,
    scale: 1.4,
    rotationYRadians: 0,
    yOffset: 0,
    headBoneName: 'Head',
    torsoBoneName: 'Spine01',
    rootBoneName: 'Hips',
    clips: { idle: 'idle', approach: 'approach', hitReact: 'hit', deadHeadshot: 'dead', deadBody: 'dead_back', reach: 'reach' },
    hitbox: { headCenterY: 1.4, headRadius: 0.3, torsoCenterY: 0.82, torsoRadius: 0.3, torsoHeight: 0.35 },
    answerLabelYOffset: 2.5,
    supportsTint: true,
    attribution: { toolOrSource: 'test', license: 'test', licenseUrl: 'test', attributionText: 'test', dateAcquired: '2026-01-01', localPath: 'test' },
  }
}

/** A deterministic stand-in for `Math.random` — cycles through a fixed
 * sequence so tests never depend on real randomness. */
function sequenceRandom(values: number[]): RandomFn {
  let i = 0
  return () => values[i++ % values.length]
}

describe('shuffle', () => {
  it('does not mutate its input', () => {
    const items = ['a', 'b', 'c', 'd']
    const original = [...items]
    shuffle(items, sequenceRandom([0.9, 0.1, 0.5]))
    expect(items).toEqual(original)
  })

  it('returns every original element exactly once', () => {
    const items = ['a', 'b', 'c', 'd']
    const result = shuffle(items, sequenceRandom([0.1, 0.9, 0.3, 0.7]))
    expect([...result].sort()).toEqual([...items].sort())
  })

  it('is deterministic for a given random function', () => {
    const items = [1, 2, 3, 4, 5]
    const a = shuffle(items, sequenceRandom([0.9, 0.1, 0.8, 0.2, 0.5]))
    const b = shuffle(items, sequenceRandom([0.9, 0.1, 0.8, 0.2, 0.5]))
    expect(a).toEqual(b)
  })
})

describe('selectSessionRoster', () => {
  it('selects four unique characters from a larger registry', () => {
    const registry = Array.from({ length: 8 }, (_, i) => makeCharacter(`char-${i}`))
    const roster = selectSessionRoster(registry, 4, sequenceRandom([0.9, 0.1, 0.5, 0.3, 0.7, 0.2, 0.6, 0.4]))
    expect(roster).toHaveLength(4)
    const ids = roster.map((c) => c.id)
    expect(new Set(ids).size).toBe(4)
  })

  it('selects all four when exactly four are enabled', () => {
    const registry = [makeCharacter('a'), makeCharacter('b'), makeCharacter('c'), makeCharacter('d')]
    const roster = selectSessionRoster(registry, 4, sequenceRandom([0.5, 0.5, 0.5]))
    expect(roster.map((c) => c.id).sort()).toEqual(['a', 'b', 'c', 'd'])
  })

  it('never includes a disabled character', () => {
    const registry = [makeCharacter('a'), makeCharacter('b', false), makeCharacter('c'), makeCharacter('d'), makeCharacter('e')]
    for (let trial = 0; trial < 20; trial++) {
      const roster = selectSessionRoster(registry, 4, () => Math.random())
      expect(roster.map((c) => c.id)).not.toContain('b')
    }
  })

  it('is deterministic given an injected random function', () => {
    const registry = Array.from({ length: 6 }, (_, i) => makeCharacter(`char-${i}`))
    const random = sequenceRandom([0.9, 0.4, 0.1, 0.6, 0.3])
    const a = selectSessionRoster(registry, 4, sequenceRandom([0.9, 0.4, 0.1, 0.6, 0.3]))
    const b = selectSessionRoster(registry, 4, random)
    expect(a).toEqual(b)
  })

  it('never mutates the registry it is given', () => {
    const registry = [makeCharacter('a'), makeCharacter('b'), makeCharacter('c'), makeCharacter('d')]
    const before = registry.map((c) => c.id)
    selectSessionRoster(registry, 4, sequenceRandom([0.5, 0.2, 0.8]))
    expect(registry.map((c) => c.id)).toEqual(before)
  })

  it('throws rather than silently returning fewer than requested when not enough are enabled', () => {
    const registry = [makeCharacter('a'), makeCharacter('b', false), makeCharacter('c', false)]
    expect(() => selectSessionRoster(registry, 4)).toThrow(/enabled/)
  })
})
