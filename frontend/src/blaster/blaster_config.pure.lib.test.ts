import { describe, expect, it } from 'vitest'
import { DEFAULT_WEAPON_VIEW, MUZZLE_FLASH_DURATION_MS, MUZZLE_LIGHT_DURATION_MS, MUZZLE_SPARK_DURATION_MS } from './blaster_config.pure.lib.ts'

describe('blaster config', () => {
  it('the default view is a sane foreground pose', () => {
    expect(DEFAULT_WEAPON_VIEW.weaponScale).toBeGreaterThan(0)
    expect(DEFAULT_WEAPON_VIEW.weaponPosition[2]).toBeLessThan(0)
    expect(DEFAULT_WEAPON_VIEW.cockingSlideDistance).toBeGreaterThan(0)
  })

  it('every muzzle effect is short: a flash, not a glow', () => {
    for (const ms of [MUZZLE_FLASH_DURATION_MS, MUZZLE_SPARK_DURATION_MS, MUZZLE_LIGHT_DURATION_MS]) {
      expect(ms).toBeGreaterThan(0)
      expect(ms).toBeLessThanOrEqual(100)
    }
  })
})
