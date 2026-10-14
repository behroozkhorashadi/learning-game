import { useTexture } from '@react-three/drei'
import type { ReactElement } from 'react'
import { AsyncBoundary } from '@app/boundary/async_boundary.pure.ui.tsx'
import type { EmblemSpot } from './blaster_finish.pure.lib.ts'

/**
 * An emblem stuck on a model: a disc in the ring colour with the picture on
 * it, on each face of `spot`. The picture loads as a texture; until it
 * has (or if it fails) the plain coloured disc shows. Never raycast, so it
 * can't block a shot.
 */

export interface EmblemBadgeProps {
  readonly imageUrl: string
  readonly ringColor: string
  readonly spot: EmblemSpot
}

const SEGMENTS = 40
const RING = 1.18

function Picture({ imageUrl, radius }: { readonly imageUrl: string; readonly radius: number }): ReactElement {
  const texture = useTexture(imageUrl)
  return (
    <mesh position={[0, 0, 0.002]} raycast={() => null}>
      <circleGeometry args={[radius, SEGMENTS]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  )
}

function Face({ imageUrl, ringColor, radius }: { readonly imageUrl: string; readonly ringColor: string; readonly radius: number }): ReactElement {
  return (
    <>
      <mesh raycast={() => null}>
        <circleGeometry args={[radius * RING, SEGMENTS]} />
        <meshStandardMaterial color={ringColor} roughness={0.4} />
      </mesh>
      <AsyncBoundary loading={null} failed={() => null}>
        <Picture imageUrl={imageUrl} radius={radius} />
      </AsyncBoundary>
    </>
  )
}

export function EmblemBadge({ imageUrl, ringColor, spot }: EmblemBadgeProps): ReactElement {
  return (
    <group name="emblem">
      {spot.faces.map((face) => (
        <group key={face.position.join()} position={face.position} rotation={face.rotation}>
          <Face imageUrl={imageUrl} ringColor={ringColor} radius={spot.radius} />
        </group>
      ))}
    </group>
  )
}
