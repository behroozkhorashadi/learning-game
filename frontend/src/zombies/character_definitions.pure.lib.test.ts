import { describe, expect, it } from 'vitest'
import { CHARACTER_DEFINITIONS, SCIENTIST_ZOMBIE, ZOMBIE_CHARACTER_REGISTRY } from './character_definitions.pure.lib.ts'

describe('the character registry', () => {
  it('has at least the four characters a wave needs, enabled, with unique ids', () => {
    const enabled = ZOMBIE_CHARACTER_REGISTRY.filter((c) => c.enabled)
    expect(enabled.length).toBeGreaterThanOrEqual(4)
    expect(new Set(ZOMBIE_CHARACTER_REGISTRY.map((c) => c.id)).size).toBe(ZOMBIE_CHARACTER_REGISTRY.length)
  })

  it('maps every clip role, bone, model, and groan for each character', () => {
    for (const c of ZOMBIE_CHARACTER_REGISTRY) {
      expect(Object.keys(c.clips).sort()).toEqual(['approach', 'deadBody', 'deadHeadshot', 'hitReact', 'idle', 'reach'])
      expect(c.modelUrl).toMatch(/\.glb$/)
      expect(c.groanSoundUrl).toMatch(/\.wav$/)
      expect([c.headBoneName, c.torsoBoneName, c.rootBoneName].every((name) => name.length > 0)).toBe(true)
    }
  })

  it('looks characters up by id', () => {
    expect(CHARACTER_DEFINITIONS[SCIENTIST_ZOMBIE.id]).toBe(SCIENTIST_ZOMBIE)
  })
})
