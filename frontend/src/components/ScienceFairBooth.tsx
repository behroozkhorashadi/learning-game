import type { JSX } from 'react'
import type { BoothSubject } from '../lib/environmentLayout'
import { PrimShape } from './PrimShape'
import { unitBoxGeometry, unitConeGeometry, unitCylinderGeometry, unitSphereGeometry, unitTorusGeometry } from '../lib/sharedEnvironmentGeometry'

/**
 * A science-fair table + tilted display board, topped with a small
 * procedural motif for one of seven subjects. Purely decorative — the
 * table+board footprint this visually represents is what
 * `EnvironmentProp`'s paired `EnvironmentCollider` actually blocks shots
 * and zombie paths with (see `environmentLayout.ts` for the shared
 * placement data both read from).
 *
 * Kept deliberately simple/iconic (a handful of reused primitive shapes per
 * subject) rather than modeled detail — this is a "toy-like" school science
 * fair, not a realistic diorama, and every subject reuses the same six
 * shared unit geometries (see `sharedEnvironmentGeometry.ts`).
 */

const BOARD_COLORS: Record<BoothSubject, string> = {
  volcano: '#E8573F',
  solar_system: '#2A2E6B',
  magnets: '#D6336C',
  simple_machines: '#F0A020',
  geometry: '#3D8BFF',
  plants: '#3FA34D',
  electricity: '#F5C518',
}

function VolcanoMotif() {
  return (
    <>
      <PrimShape geometry={unitConeGeometry} color="#8B4A3A" position={[0, 0.35, 0]} scale={[0.5, 0.7, 0.5]} />
      <PrimShape geometry={unitSphereGeometry} color="#FF7A33" emissive="#FF5A1F" emissiveIntensity={1.1} position={[0, 0.68, 0]} scale={[0.16, 0.16, 0.16]} />
    </>
  )
}

function SolarSystemMotif() {
  return (
    <>
      <PrimShape geometry={unitSphereGeometry} color="#FFC94A" emissive="#FF9900" emissiveIntensity={0.6} position={[0, 0.42, 0]} scale={[0.22, 0.22, 0.22]} />
      <PrimShape geometry={unitTorusGeometry} color="#8FA8FF" position={[0, 0.42, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[0.9, 0.9, 0.9]} />
      <PrimShape geometry={unitSphereGeometry} color="#3D8BFF" position={[0.36, 0.42, 0]} scale={[0.08, 0.08, 0.08]} />
      <PrimShape geometry={unitSphereGeometry} color="#E85A3F" position={[-0.3, 0.42, 0.2]} scale={[0.1, 0.1, 0.1]} />
    </>
  )
}

function MagnetsMotif() {
  return (
    <>
      <PrimShape geometry={unitBoxGeometry} color="#D6336C" position={[-0.12, 0.4, 0]} scale={[0.12, 0.32, 0.14]} />
      <PrimShape geometry={unitBoxGeometry} color="#3D8BFF" position={[0.12, 0.4, 0]} scale={[0.12, 0.32, 0.14]} />
      <PrimShape geometry={unitBoxGeometry} color="#C0C0C0" position={[0, 0.24, 0]} scale={[0.36, 0.08, 0.14]} />
    </>
  )
}

function SimpleMachinesMotif() {
  return (
    <>
      <PrimShape geometry={unitConeGeometry} color="#8B8B8B" position={[0, 0.22, 0]} scale={[0.24, 0.3, 0.24]} />
      <PrimShape geometry={unitBoxGeometry} color="#F0A020" position={[0, 0.38, 0]} rotation={[0, 0, 0.35]} scale={[0.7, 0.06, 0.14]} />
    </>
  )
}

function GeometryMotif() {
  return (
    <>
      <PrimShape geometry={unitBoxGeometry} color="#3D8BFF" position={[-0.16, 0.32, 0]} rotation={[0.5, 0.4, 0]} scale={[0.2, 0.2, 0.2]} />
      <PrimShape geometry={unitSphereGeometry} color="#5BCC2D" position={[0.16, 0.4, 0]} scale={[0.16, 0.16, 0.16]} />
      <PrimShape geometry={unitConeGeometry} color="#F59E0B" position={[0, 0.24, 0.18]} scale={[0.16, 0.24, 0.16]} />
    </>
  )
}

function PlantsMotif() {
  return (
    <>
      <PrimShape geometry={unitCylinderGeometry} color="#B5652F" position={[0, 0.16, 0]} scale={[0.16, 0.22, 0.16]} />
      <PrimShape geometry={unitSphereGeometry} color="#3FA34D" position={[0, 0.36, 0]} scale={[0.2, 0.22, 0.2]} />
      <PrimShape geometry={unitConeGeometry} color="#4CAF50" position={[0, 0.5, 0]} scale={[0.14, 0.2, 0.14]} />
    </>
  )
}

function ElectricityMotif() {
  return (
    <>
      <PrimShape geometry={unitBoxGeometry} color="#F5C518" emissive="#FFEA70" emissiveIntensity={0.7} position={[0.04, 0.46, 0]} rotation={[0, 0, 0.5]} scale={[0.07, 0.28, 0.05]} />
      <PrimShape geometry={unitBoxGeometry} color="#F5C518" emissive="#FFEA70" emissiveIntensity={0.7} position={[-0.04, 0.3, 0]} rotation={[0, 0, -0.5]} scale={[0.07, 0.28, 0.05]} />
    </>
  )
}

const MOTIFS: Record<BoothSubject, () => JSX.Element> = {
  volcano: VolcanoMotif,
  solar_system: SolarSystemMotif,
  magnets: MagnetsMotif,
  simple_machines: SimpleMachinesMotif,
  geometry: GeometryMotif,
  plants: PlantsMotif,
  electricity: ElectricityMotif,
}

interface Props {
  subject: BoothSubject
}

/** Local coordinates only — `EnvironmentProp` positions/rotates the whole
 * group; this never reads world position itself. */
export function ScienceFairBooth({ subject }: Props) {
  const Motif = MOTIFS[subject]
  const boardColor = BOARD_COLORS[subject]

  return (
    <group>
      {/* table */}
      <PrimShape geometry={unitBoxGeometry} color="#F4E9D8" position={[0, 0.35, 0]} scale={[0.75, 0.7, 0.5]} castShadow receiveShadow />
      {/* display board, tilted back slightly */}
      <PrimShape geometry={unitBoxGeometry} color={boardColor} position={[0, 1.05, -0.2]} rotation={[-0.12, 0, 0]} scale={[0.85, 0.9, 0.04]} castShadow />
      {/* subject motif, enlarged and floated in front of the board so it
       * reads clearly rather than disappearing against the table surface */}
      <group position={[0, 0.55, 0.12]} scale={2.1}>
        <Motif />
      </group>
    </group>
  )
}
