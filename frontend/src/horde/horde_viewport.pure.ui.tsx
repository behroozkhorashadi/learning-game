import { Canvas } from '@react-three/fiber'
import type { ReactElement } from 'react'
import { AsyncBoundary } from '@app/boundary/async_boundary.pure.ui.tsx'
import { HordeScene, type HordeSceneProps } from './horde_scene.pure.ui.tsx'

export interface HordeViewportProps extends HordeSceneProps {
  /** The scene failed to load (a model, a texture): the game shows a message instead of an empty canvas. */
  readonly onSceneError: (error: unknown) => void
}

/**
 * The 3D view: a <Canvas> around the scene, with the scene's loads caught
 * inside the canvas (a different renderer, so the boundary lives in here),
 * and a click that hits nothing at all counted as a miss.
 */
export function HordeViewport({ onSceneError, ...scene }: HordeViewportProps): ReactElement {
  return (
    <Canvas
      shadows={scene.shadows}
      onPointerMissed={() => {
        if (!scene.grenadeArmed) scene.onShot(null)
      }}
    >
      <AsyncBoundary loading={null} failed={() => null} onError={onSceneError}>
        <HordeScene {...scene} />
      </AsyncBoundary>
    </Canvas>
  )
}
