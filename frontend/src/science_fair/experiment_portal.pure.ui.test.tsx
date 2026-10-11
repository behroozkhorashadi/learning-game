import ReactThreeTestRenderer from '@react-three/test-renderer'
import type * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { ExperimentPortal } from './experiment_portal.pure.ui.tsx'

function ring(renderer: Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>): THREE.Object3D | undefined {
  return renderer.scene.children[0]?.children[0]?.instance
}

describe('ExperimentPortal', () => {
  it('turns its ring and drifts mist motes', async () => {
    const renderer = await ReactThreeTestRenderer.create(<ExperimentPortal reducedMotion={false} />)
    await ReactThreeTestRenderer.act(async () => {
      await renderer.advanceFrames(10, 0.1)
    })
    expect(ring(renderer)?.rotation.z).not.toBe(0)
    expect(renderer.scene.children[0]?.children.length).toBeGreaterThan(2)
  })

  it('holds still, without mist, under reduced motion', async () => {
    const renderer = await ReactThreeTestRenderer.create(<ExperimentPortal reducedMotion />)
    await ReactThreeTestRenderer.act(async () => {
      await renderer.advanceFrames(10, 0.1)
    })
    expect(ring(renderer)?.rotation.z).toBe(0)
    expect(renderer.scene.children[0]?.children).toHaveLength(2)
  })
})
