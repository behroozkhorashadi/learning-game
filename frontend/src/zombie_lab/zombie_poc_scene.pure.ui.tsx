import { useState, type ReactElement } from 'react'
import { AsyncBoundary } from '@app/boundary/async_boundary.pure.ui.tsx'
import { Canvas } from '@react-three/fiber'
import { Grid, PerspectiveCamera } from '@react-three/drei'
import { ZombieCharacter3D } from '@app/zombies/zombie_character_3d.pure.ui.tsx'
import type { ZombieClipRole } from '@app/zombies/zombie_animation_fallback.pure.lib.ts'
import { SCIENTIST_ZOMBIE, ZOMBIE_CHARACTER_REGISTRY } from '@app/zombies/character_definitions.pure.lib.ts'

/**
 * Isolated, throwaway-style proof-of-concept scene (dev-only, `?screen=zombie-3d-poc`).
 * Exists purely to visually confirm each registered character's GLB
 * scale/orientation/animation mappings before wiring the real game — see
 * the asset audit for why the exported scale needed correcting. Not part
 * of the shipped game. Character picker added when the registry grew past
 * the original single scientist model, so a newly-registered character can
 * be checked in isolation without spinning up a full session.
 */
const ROLES: readonly ZombieClipRole[] = ['idle', 'approach', 'hitReact', 'deadHeadshot', 'deadBody', 'reach']

export function ZombiePOCScene(): ReactElement {
  const [role, setRole] = useState<ZombieClipRole>('idle')
  const [characterId, setCharacterId] = useState(SCIENTIST_ZOMBIE.id)
  const character = ZOMBIE_CHARACTER_REGISTRY.find((c) => c.id === characterId) ?? SCIENTIST_ZOMBIE

  return (
    <div style={{ width: '100%', height: '100vh', position: 'relative', background: '#222' }}>
      <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {ZOMBIE_CHARACTER_REGISTRY.map((c) => (
            <button
              key={c.id}
              type="button"
              aria-pressed={c.id === characterId}
              onClick={() => {
                setCharacterId(c.id)
              }}
              style={{ padding: '6px 10px', fontWeight: c.id === characterId ? 700 : 400 }}>
              {c.displayName}
              {!c.enabled ? ' (disabled)' : ''}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {ROLES.map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={r === role}
              onClick={() => {
                setRole(r)
              }}
              style={{ padding: '6px 10px', fontWeight: r === role ? 700 : 400 }}>
              {r}
            </button>
          ))}
        </div>
        {character.heldProp !== undefined && (
          <div style={{ color: '#fff', fontFamily: 'monospace', fontSize: 12 }}>
            Held prop: {character.heldProp.label} — {character.heldProp.description}
          </div>
        )}
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
        <AsyncBoundary loading={null} failed={() => null}>
          <ZombieCharacter3D key={character.id} character={character} clipRole={role} />
        </AsyncBoundary>
      </Canvas>
    </div>
  )
}
