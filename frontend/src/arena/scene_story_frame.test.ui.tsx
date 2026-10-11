import { PerspectiveCamera } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { useRef, type ReactElement, type ReactNode } from 'react'
import { AsyncBoundary } from '@app/boundary/async_boundary.pure.ui.tsx'

/**
 * A stage for the 3D components' stories: a lit canvas with a fixed camera
 * and a boundary around the content. Once the scene has drawn its first
 * frames the frame is marked `data-scene-ready="true"`, which the stories'
 * play functions wait for (a real browser, real WebGL, the real models).
 */

/** Calls `onReady` on the first frame drawn after everything above it (in the same boundary) has loaded. */
function ReadyWhenDrawn({ onReady }: { readonly onReady: () => void }): null {
  const done = useRef(false)
  useFrame(() => {
    if (done.current) return
    done.current = true
    onReady()
  })
  return null
}

export interface SceneStoryFrameProps {
  readonly children: ReactNode
  readonly camera?: readonly [number, number, number]
  readonly fov?: number
  readonly height?: number
  /** Told when a load inside the scene fails (stories assert on it). */
  readonly onError?: (error: unknown) => void
}

export function SceneStoryFrame({ children, camera = [0, 1.55, 3], fov = 55, height = 420, onError }: SceneStoryFrameProps): ReactElement {
  const frame = useRef<HTMLDivElement>(null)
  return (
    <div ref={frame} role="figure" aria-label="3D scene" data-scene-ready="false" style={{ width: '100%', height, background: '#1b1530' }}>
      <Canvas>
        <PerspectiveCamera makeDefault position={camera} fov={fov} />
        <ambientLight intensity={0.8} />
        <directionalLight position={[3, 6, 4]} intensity={1.2} />
        <AsyncBoundary loading={null} failed={() => null} {...(onError === undefined ? {} : { onError })}>
          {children}
          <ReadyWhenDrawn
            onReady={() => {
              frame.current?.setAttribute('data-scene-ready', 'true')
            }}
          />
        </AsyncBoundary>
      </Canvas>
    </div>
  )
}
