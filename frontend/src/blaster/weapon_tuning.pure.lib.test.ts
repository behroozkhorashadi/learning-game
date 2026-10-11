import { describe, expect, it } from 'vitest'
import { DEFAULT_WEAPON_VIEW } from './blaster_config.pure.lib.ts'
import { TUNING_SECTIONS, toConfigSnippet, withAxis } from './weapon_tuning.pure.lib.ts'

function field(section: string, label: string) {
  const found = TUNING_SECTIONS.find((s) => s.title === section)?.fields.find((f) => f.label === label)
  if (found === undefined) throw new Error(`no field ${section} ${label}`)
  return found
}

describe('weapon tuning', () => {
  it('replaces one axis of a vector', () => {
    expect(withAxis([1, 2, 3], 1, 9)).toEqual([1, 9, 3])
  })

  it('edits rotations in degrees and stores radians', () => {
    const rotY = field('Weapon', 'Rot Y (deg)')
    const next = rotY.set(DEFAULT_WEAPON_VIEW, 90)
    expect(next.weaponRotation[1]).toBeCloseTo(Math.PI / 2)
    expect(rotY.get(next)).toBeCloseTo(90)
  })

  it('has a section per part, with the cocking travel on the left arm', () => {
    expect(TUNING_SECTIONS.map((s) => s.title)).toEqual(['Weapon', 'Right arm', 'Left arm'])
    expect(field('Left arm', 'Cocking travel').set(DEFAULT_WEAPON_VIEW, 0.2).cockingSlideDistance).toBe(0.2)
  })

  it('writes the view as a pasteable DEFAULT_WEAPON_VIEW literal', () => {
    const snippet = toConfigSnippet(DEFAULT_WEAPON_VIEW)
    expect(snippet.startsWith('export const DEFAULT_WEAPON_VIEW: WeaponViewConfig = {')).toBe(true)
    expect(snippet).toContain(`weaponScale: ${String(Number(DEFAULT_WEAPON_VIEW.weaponScale.toFixed(4)))},`)
  })
})
