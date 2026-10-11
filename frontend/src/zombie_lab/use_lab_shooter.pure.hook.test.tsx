import ReactThreeTestRenderer from '@react-three/test-renderer'
import { useEffect, useRef, type ReactElement } from 'react'
import * as THREE from 'three'
import { describe, expect, it, vi } from 'vitest'
import { tagZombieMesh } from '@app/arena/raycast_tags.pure.lib.ts'
import { SETTLED_FRAMES, useLabShooter, type LabShooter } from './use_lab_shooter.pure.hook.ts'

/** A one-mesh zombie in front of the default camera, tagged once `tagged` is true. */
function Range({
  tagged,
  setupKey,
  onShooter,
  onSettled,
}: {
  readonly tagged: boolean
  readonly setupKey: string
  readonly onShooter: (s: LabShooter | null) => void
  readonly onSettled: (key: string) => void
}): ReactElement {
  const mesh = useRef<THREE.Mesh>(null)
  useEffect(() => {
    if (mesh.current) tagZombieMesh(mesh.current, tagged ? { carrierId: 'z', zoneAt: (p) => (p.y > 0 ? 'head' : 'body') } : null)
  }, [tagged])
  useLabShooter(setupKey, onShooter, onSettled)
  return (
    <mesh ref={mesh} position={[0, 0, -5]}>
      <boxGeometry args={[2, 2, 2]} />
    </mesh>
  )
}

describe('useLabShooter', () => {
  it('shoots along the camera ray and classifies the hit like the game', async () => {
    const latest: { shooter: LabShooter | null } = { shooter: null }
    const renderer = await ReactThreeTestRenderer.create(
      <Range
        tagged
        setupKey="a"
        onShooter={(s) => {
          latest.shooter = s
        }}
        onSettled={vi.fn()}
      />,
    )
    await ReactThreeTestRenderer.act(async () => {
      await renderer.advanceFrames(1, 1 / 60)
    })
    const ready = latest.shooter
    expect(ready?.hasZombie()).toBe(true)
    expect(ready?.shoot({ x: 0, y: 0.01 })).toBe('head')
    expect(ready?.shoot({ x: 0.99, y: 0.99 })).toBe('miss')
  })

  it('reports a setup settled once the zombie has been a target for enough frames in a row, once', async () => {
    const onSettled = vi.fn()
    const renderer = await ReactThreeTestRenderer.create(<Range tagged={false} setupKey="a" onShooter={vi.fn()} onSettled={onSettled} />)
    await ReactThreeTestRenderer.act(async () => {
      await renderer.advanceFrames(SETTLED_FRAMES + 2, 1 / 60)
    })
    expect(onSettled).not.toHaveBeenCalled()
    await ReactThreeTestRenderer.act(async () => {
      await renderer.update(<Range tagged setupKey="a" onShooter={vi.fn()} onSettled={onSettled} />)
    })
    await ReactThreeTestRenderer.act(async () => {
      await renderer.advanceFrames(SETTLED_FRAMES + 5, 1 / 60)
    })
    expect(onSettled).toHaveBeenCalledTimes(1)
    expect(onSettled).toHaveBeenCalledWith('a')
  })
})
