import { useState } from 'react'
import type { WeaponViewConfig, Vec3Tuple } from '../lib/equationBlasterConfig'

/**
 * Dev-only live tuning panel for the entire first-person weapon
 * presentation (`?tuneWeapon=1`, gated to `import.meta.env.DEV` by the
 * caller — see `isWeaponTuningEnabled` in `ZombieMathBlaster.tsx`). Exists
 * because repeatedly guessing transform numbers from screenshots kept
 * missing — this hands direct, real-time control to whoever is actually
 * looking at the live render, in the exact same first-person view the game
 * uses (not an isolated POC scene at a different angle/distance), so the
 * final numbers are read off something that's already confirmed to look
 * right rather than guessed and re-guessed.
 *
 * Purely a plain HTML overlay sibling of the `<Canvas>` — same pattern as
 * the charge HUD / mute button already in `ZombieMathBlaster.tsx` — so it
 * can't be rendered from inside `EquationOutbreakScene`/`EquationBlaster`
 * themselves (those are R3F scene components, not DOM). No new dependency:
 * plain `<input type="range">`/`<input type="number">` controls.
 */

const RAD_TO_DEG = 180 / Math.PI
const DEG_TO_RAD = Math.PI / 180

interface Props {
  value: WeaponViewConfig
  onChange: (next: WeaponViewConfig) => void
  hideRightArm: boolean
  onHideRightArmChange: (hidden: boolean) => void
  hideLeftArm: boolean
  onHideLeftArmChange: (hidden: boolean) => void
}

type NumericKey = { [K in keyof WeaponViewConfig]: WeaponViewConfig[K] extends number ? K : never }[keyof WeaponViewConfig]
type Vec3Key = { [K in keyof WeaponViewConfig]: WeaponViewConfig[K] extends Vec3Tuple ? K : never }[keyof WeaponViewConfig]

interface FieldSpec {
  label: string
  get: (s: WeaponViewConfig) => number
  set: (s: WeaponViewConfig, v: number) => WeaponViewConfig
  min: number
  max: number
  step: number
}

function vec3Field(key: Vec3Key, axis: 0 | 1 | 2, label: string, min: number, max: number, step: number, isRotation: boolean): FieldSpec {
  return {
    label,
    get: (s) => (isRotation ? s[key][axis] * RAD_TO_DEG : s[key][axis]),
    set: (s, v) => {
      const raw = isRotation ? v * DEG_TO_RAD : v
      const next = [...s[key]] as [number, number, number]
      next[axis] = raw
      return { ...s, [key]: next }
    },
    min,
    max,
    step,
  }
}

function scalarField(key: NumericKey, label: string, min: number, max: number, step: number): FieldSpec {
  return {
    label,
    get: (s) => s[key],
    set: (s, v) => ({ ...s, [key]: v }),
    min,
    max,
    step,
  }
}

const AXIS_LABELS = ['X', 'Y', 'Z'] as const

function posRotScaleFields(posKey: Vec3Key, rotKey: Vec3Key, scaleKey: NumericKey): FieldSpec[] {
  const fields: FieldSpec[] = []
  for (let i = 0; i < 3; i++) fields.push(vec3Field(posKey, i as 0 | 1 | 2, `Pos ${AXIS_LABELS[i]}`, -0.8, 0.8, 0.005, false))
  for (let i = 0; i < 3; i++) fields.push(vec3Field(rotKey, i as 0 | 1 | 2, `Rot ${AXIS_LABELS[i]} (deg)`, -180, 180, 1, true))
  fields.push(scalarField(scaleKey, 'Scale', 0.05, 1.2, 0.01))
  return fields
}

function weaponFields(): FieldSpec[] {
  const fields = posRotScaleFields('weaponPosition', 'weaponRotation', 'weaponScale')
  for (let i = 0; i < 3; i++) fields.push(vec3Field('muzzlePosition', i as 0 | 1 | 2, `Muzzle ${AXIS_LABELS[i]}`, -0.8, 0.8, 0.005, false))
  return fields
}

function rightArmFields(): FieldSpec[] {
  return posRotScaleFields('rightGripPosition', 'rightArmRotation', 'rightArmScale')
}

function leftArmFields(): FieldSpec[] {
  const fields = posRotScaleFields('leftGripPosition', 'leftArmRotation', 'leftArmScale')
  fields.push(scalarField('cockingSlideDistance', 'Cocking travel', 0, 0.5, 0.005))
  return fields
}

function Section({ title, fields, value, onChange }: { title: string; fields: FieldSpec[]; value: WeaponViewConfig; onChange: (next: WeaponViewConfig) => void }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{title}</div>
      {fields.map((field) => (
        <div key={field.label} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <label style={{ width: 110, flexShrink: 0 }}>{field.label}</label>
          <input
            type="range"
            min={field.min}
            max={field.max}
            step={field.step}
            value={field.get(value)}
            onChange={(e) => onChange(field.set(value, Number(e.target.value)))}
            style={{ width: 100 }}
          />
          <input
            type="number"
            value={Number(field.get(value).toFixed(4))}
            step={field.step}
            onChange={(e) => {
              const v = Number(e.target.value)
              if (!Number.isNaN(v)) onChange(field.set(value, v))
            }}
            style={{ width: 60 }}
          />
        </div>
      ))}
    </div>
  )
}

function formatVec3(v: Vec3Tuple): string {
  return `[${v.map((n) => Number(n.toFixed(4))).join(', ')}]`
}

function toConfigSnippet(value: WeaponViewConfig): string {
  return [
    `export const DEFAULT_WEAPON_VIEW: WeaponViewConfig = {`,
    `  weaponPosition: ${formatVec3(value.weaponPosition)},`,
    `  weaponRotation: ${formatVec3(value.weaponRotation)},`,
    `  weaponScale: ${Number(value.weaponScale.toFixed(4))},`,
    `  muzzlePosition: ${formatVec3(value.muzzlePosition)},`,
    `  rightGripPosition: ${formatVec3(value.rightGripPosition)},`,
    `  rightArmRotation: ${formatVec3(value.rightArmRotation)},`,
    `  rightArmScale: ${Number(value.rightArmScale.toFixed(4))},`,
    `  leftGripPosition: ${formatVec3(value.leftGripPosition)},`,
    `  leftArmRotation: ${formatVec3(value.leftArmRotation)},`,
    `  leftArmScale: ${Number(value.leftArmScale.toFixed(4))},`,
    `  cockingSlideDistance: ${Number(value.cockingSlideDistance.toFixed(4))},`,
    `}`,
  ].join('\n')
}

export function WeaponTuningPanel({ value, onChange, hideRightArm, onHideRightArmChange, hideLeftArm, onHideLeftArmChange }: Props) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    const snippet = toConfigSnippet(value)
    try {
      await navigator.clipboard.writeText(snippet)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard access can be denied — the snippet is also always
      // visible in the <pre> below, so this never blocks the workflow.
    }
  }

  return (
    <div
      style={{
        position: 'absolute',
        top: 16,
        left: 16,
        zIndex: 300,
        width: 320,
        maxHeight: 'calc(100% - 32px)',
        overflowY: 'auto',
        background: 'rgba(20,20,28,0.92)',
        color: '#EAEAF0',
        borderRadius: 12,
        padding: 12,
        fontFamily: 'monospace',
        fontSize: 11,
        pointerEvents: 'auto',
      }}
    >
      <div style={{ fontWeight: 800, marginBottom: 8, fontSize: 13 }}>Weapon tuning (?tuneWeapon=1)</div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <input type="checkbox" checked={hideRightArm} onChange={(e) => onHideRightArmChange(e.target.checked)} />
          Hide right arm
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <input type="checkbox" checked={hideLeftArm} onChange={(e) => onHideLeftArmChange(e.target.checked)} />
          Hide left arm
        </label>
      </div>

      <Section title="Weapon" fields={weaponFields()} value={value} onChange={onChange} />
      <Section title="Right arm" fields={rightArmFields()} value={value} onChange={onChange} />
      <Section title="Left arm" fields={leftArmFields()} value={value} onChange={onChange} />

      <button type="button" onClick={handleCopy} style={{ marginBottom: 6, padding: '4px 10px', cursor: 'pointer' }}>
        {copied ? 'Copied!' : 'Copy config snippet'}
      </button>
      <pre style={{ whiteSpace: 'pre-wrap', background: 'rgba(255,255,255,0.06)', padding: 6, borderRadius: 6, margin: 0 }}>{toConfigSnippet(value)}</pre>
    </div>
  )
}
