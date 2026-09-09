import { Suspense, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Grid, PerspectiveCamera } from '@react-three/drei'
import { ZombieCharacter3D, type ZombieClipRole } from '../components/ZombieCharacter3D'
import { SCIENTIST_ZOMBIE } from '../lib/characterDefinitions'

/**
 * Isolated, throwaway-style proof-of-concept scene (dev-only, `?screen=zombie-3d-poc`).
 * Exists purely to visually confirm the GLB's scale/orientation/animation
 * mappings before wiring the real game — see the asset audit for why the
 * exported scale needed correcting. Not part of the shipped game.
 */
const ROLES: ZombieClipRole[] = ['idle', 'approach', 'hitReact', 'deadHeadshot', 'deadBody', 'reach']

export function ZombiePOCScene() {
  const [role, setRole] = useState<ZombieClipRole>('idle')

  return (
    <div style={{ width: '100%', height: '100vh', position: 'relative', background: '#222' }}>
      <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {ROLES.map((r) => (
          <button key={r} onClick={() => setRole(r)} style={{ padding: '6px 10px' }}>
            {r}
          </button>
        ))}
      </div>
      <Canvas shadows>
        <PerspectiveCamera makeDefault position={[0, 1.6, 4]} fov={50} />
        <ambientLight intensity={0.6} />
        <directionalLight position={[3, 5, 2]} intensity={1.2} castShadow />
        <Grid args={[20, 20]} cellSize={0.5} sectionSize={1} fadeDistance={20} />
        {/* 1-unit reference cube so height is visually checkable against the grid */}
        <mesh position={[1.5, 0.5, 0]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="orange" wireframe />
        </mesh>
        <Suspense fallback={null}>
          <ZombieCharacter3D character={SCIENTIST_ZOMBIE} clipRole={role} />
        </Suspense>
      </Canvas>
    </div>
  )
}
