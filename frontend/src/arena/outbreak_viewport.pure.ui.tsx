import { Canvas } from '@react-three/fiber'
import type { ReactElement } from 'react'
import { AsyncBoundary } from '@app/boundary/async_boundary.pure.ui.tsx'
import { OutbreakScene, type OutbreakSceneProps } from './outbreak_scene.pure.ui.tsx'

export interface OutbreakViewportProps extends OutbreakSceneProps {
  /** Soft shadows; off under reduced motion, where they buy nothing. */
  readonly shadows: boolean
  /** The scene failed to load (a model, a texture): the arena shows a message instead of an empty canvas. */
  readonly onSceneError: (error: unknown) => void
}

/**
 * The arena's 3D view: a <Canvas> around the scene, with the scene's loads
 * caught inside the canvas (it's a different renderer, so the boundary has to
 * live in here), and a click that hits nothing counted as a miss.
 */
export function OutbreakViewport({ shadows, onSceneError, onMiss, ...scene }: OutbreakViewportProps): ReactElement {
  return (
    <Canvas shadows={shadows} onPointerMissed={onMiss}>
      <AsyncBoundary loading={null} failed={() => null} onError={onSceneError}>
        <OutbreakScene {...scene} onMiss={onMiss} />
      </AsyncBoundary>
    </Canvas>
  )
}
