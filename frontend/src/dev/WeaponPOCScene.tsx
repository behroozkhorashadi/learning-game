import { Suspense, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Grid, OrbitControls, PerspectiveCamera, useGLTF } from '@react-three/drei'

/**
 * Isolated, throwaway-style proof-of-concept scene (dev-only,
 * `?screen=weapon-3d-poc`) — exists purely to visually confirm each weapon
 * GLB's real orientation/scale/origin before wiring `EquationBlaster`'s
 * transform constants, the same role `ZombiePOCScene` played for the
 * zombie characters. Not part of the shipped game.
 */

const BLASTER_URL = '/models/weapons/equation-outbreak-equation-blaster.glb'
const RIGHT_ARM_URL = '/models/weapons/equation-outbreak-right-arm.glb'
const LEFT_ARM_URL = '/models/weapons/equation-outbreak-left-arm.glb'

const ASSETS = [
  { id: 'blaster', label: 'Equation Blaster', url: BLASTER_URL },
  { id: 'right-arm', label: 'Right arm', url: RIGHT_ARM_URL },
  { id: 'left-arm', label: 'Left arm', url: LEFT_ARM_URL },
] as const

function Model({ url }: { url: string }) {
  const { scene } = useGLTF(url)
  return <primitive object={scene} />
}

export function WeaponPOCScene() {
  const [assetId, setAssetId] = useState<(typeof ASSETS)[number]['id']>('blaster')
  const asset = ASSETS.find((a) => a.id === assetId)!

  return (
    <div style={{ width: '100%', height: '100vh', position: 'relative', background: '#222' }}>
      <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {ASSETS.map((a) => (
          <button key={a.id} onClick={() => setAssetId(a.id)} style={{ padding: '6px 10px', fontWeight: a.id === assetId ? 700 : 400 }}>
            {a.label}
          </button>
        ))}
      </div>
      <div style={{ position: 'absolute', bottom: 12, left: 12, zIndex: 10, color: '#fff', fontFamily: 'monospace', fontSize: 12, maxWidth: 420 }}>
        Red = +X, Green = +Y, Blue = +Z. Grid cell = 0.1 units. Camera at (0.6, 0.6, 1.2) looking at origin.
      </div>
      <Canvas shadows>
        <PerspectiveCamera makeDefault position={[0.6, 0.6, 1.2]} fov={45} />
        <OrbitControls target={[0, 0, 0]} />
        <ambientLight intensity={0.7} />
        <directionalLight position={[1, 2, 1]} intensity={1.2} />
        <Grid args={[4, 4]} cellSize={0.1} sectionSize={0.5} fadeDistance={8} />
        {/* Big unmistakable markers at +0.6 along each axis — easier to read
         * against the model than thin axesHelper lines competing with the
         * grid's own blue-ish lines. */}
        <mesh position={[0.6, 0, 0]}>
          <sphereGeometry args={[0.03, 16, 16]} />
          <meshBasicMaterial color="red" />
        </mesh>
        <mesh position={[0, 0.6, 0]}>
          <sphereGeometry args={[0.03, 16, 16]} />
          <meshBasicMaterial color="lime" />
        </mesh>
        <mesh position={[0, 0, 0.6]}>
          <sphereGeometry args={[0.03, 16, 16]} />
          <meshBasicMaterial color="deepskyblue" />
        </mesh>
        <Suspense fallback={null}>
          <Model key={asset.url} url={asset.url} />
        </Suspense>
      </Canvas>
    </div>
  )
}

useGLTF.preload(BLASTER_URL)
useGLTF.preload(RIGHT_ARM_URL)
useGLTF.preload(LEFT_ARM_URL)
