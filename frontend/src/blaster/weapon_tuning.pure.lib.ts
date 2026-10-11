import type { Vec3Tuple, WeaponViewConfig } from './blaster_config.pure.lib.ts'

/**
 * The fields the dev-only weapon tuning panel edits (weapon_tuning_panel.pure.ui.tsx),
 * and the config snippet it copies. Rotations are edited in degrees and
 * stored in radians.
 */

const RAD_TO_DEG = 180 / Math.PI
const DEG_TO_RAD = Math.PI / 180

type NumericKey = { [K in keyof WeaponViewConfig]: WeaponViewConfig[K] extends number ? K : never }[keyof WeaponViewConfig]
type Vec3Key = { [K in keyof WeaponViewConfig]: WeaponViewConfig[K] extends Vec3Tuple ? K : never }[keyof WeaponViewConfig]

export interface TuningField {
  readonly label: string
  readonly get: (view: WeaponViewConfig) => number
  readonly set: (view: WeaponViewConfig, value: number) => WeaponViewConfig
  readonly min: number
  readonly max: number
  readonly step: number
}

export interface TuningSection {
  readonly title: string
  readonly fields: readonly TuningField[]
}

const AXES = [
  { axis: 0, label: 'X' },
  { axis: 1, label: 'Y' },
  { axis: 2, label: 'Z' },
] as const

export function withAxis(vector: Vec3Tuple, axis: 0 | 1 | 2, value: number): Vec3Tuple {
  if (axis === 0) return [value, vector[1], vector[2]]
  if (axis === 1) return [vector[0], value, vector[2]]
  return [vector[0], vector[1], value]
}

function vec3Fields(key: Vec3Key, labelPrefix: string, range: number, step: number, isRotation: boolean): readonly TuningField[] {
  return AXES.map(({ axis, label }) => ({
    label: `${labelPrefix} ${label}${isRotation ? ' (deg)' : ''}`,
    get: (view) => (isRotation ? view[key][axis] * RAD_TO_DEG : view[key][axis]),
    set: (view, value) => ({ ...view, [key]: withAxis(view[key], axis, isRotation ? value * DEG_TO_RAD : value) }),
    min: -range,
    max: range,
    step,
  }))
}

function scalarField(key: NumericKey, label: string, min: number, max: number, step: number): TuningField {
  return { label, get: (view) => view[key], set: (view, value) => ({ ...view, [key]: value }), min, max, step }
}

function poseFields(position: Vec3Key, rotation: Vec3Key, scale: NumericKey): readonly TuningField[] {
  return [...vec3Fields(position, 'Pos', 0.8, 0.005, false), ...vec3Fields(rotation, 'Rot', 180, 1, true), scalarField(scale, 'Scale', 0.05, 1.2, 0.01)]
}

export const TUNING_SECTIONS: readonly TuningSection[] = [
  { title: 'Weapon', fields: [...poseFields('weaponPosition', 'weaponRotation', 'weaponScale'), ...vec3Fields('muzzlePosition', 'Muzzle', 0.8, 0.005, false)] },
  { title: 'Right arm', fields: poseFields('rightGripPosition', 'rightArmRotation', 'rightArmScale') },
  { title: 'Left arm', fields: [...poseFields('leftGripPosition', 'leftArmRotation', 'leftArmScale'), scalarField('cockingSlideDistance', 'Cocking travel', 0, 0.5, 0.005)] },
]

function round4(n: number): number {
  return Number(n.toFixed(4))
}

function formatVec3(v: Vec3Tuple): string {
  return `[${v.map(round4).join(', ')}]`
}

/** The view as a `DEFAULT_WEAPON_VIEW` literal, ready to paste into blaster_config.pure.lib.ts. */
export function toConfigSnippet(view: WeaponViewConfig): string {
  return [
    `export const DEFAULT_WEAPON_VIEW: WeaponViewConfig = {`,
    `  weaponPosition: ${formatVec3(view.weaponPosition)},`,
    `  weaponRotation: ${formatVec3(view.weaponRotation)},`,
    `  weaponScale: ${String(round4(view.weaponScale))},`,
    `  muzzlePosition: ${formatVec3(view.muzzlePosition)},`,
    `  rightGripPosition: ${formatVec3(view.rightGripPosition)},`,
    `  rightArmRotation: ${formatVec3(view.rightArmRotation)},`,
    `  rightArmScale: ${String(round4(view.rightArmScale))},`,
    `  leftGripPosition: ${formatVec3(view.leftGripPosition)},`,
    `  leftArmRotation: ${formatVec3(view.leftArmRotation)},`,
    `  leftArmScale: ${String(round4(view.leftArmScale))},`,
    `  cockingSlideDistance: ${String(round4(view.cockingSlideDistance))},`,
    `}`,
  ].join('\n')
}
