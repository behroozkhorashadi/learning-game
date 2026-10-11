import { describe, expect, it } from 'vitest'
import { unitBoxGeometry, unitConeGeometry, unitCylinderGeometry, unitPlaneGeometry, unitSphereGeometry, unitTorusGeometry } from './shared_geometry.pure.lib.ts'

describe('shared unit geometries', () => {
  it('are unit sized, so props size them with scale', () => {
    unitBoxGeometry.computeBoundingBox()
    expect(unitBoxGeometry.boundingBox?.max.toArray()).toEqual([0.5, 0.5, 0.5])
    unitSphereGeometry.computeBoundingSphere()
    expect(unitSphereGeometry.boundingSphere?.radius).toBeCloseTo(0.5)
  })

  it('are one shared instance per shape', () => {
    expect(new Set([unitBoxGeometry, unitConeGeometry, unitCylinderGeometry, unitPlaneGeometry, unitSphereGeometry, unitTorusGeometry]).size).toBe(6)
  })
})
