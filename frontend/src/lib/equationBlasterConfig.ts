/**
 * Centralized transform constants for the first-person Equation Blaster
 * assembly (`components/EquationBlaster.tsx`) — every scale/rotation/
 * offset used to position the blaster and its two arms lives here, so a
 * browser-playtesting adjustment only ever touches this one file. The pose
 * values (weapon position/rotation/scale/muzzle, both arms' grip
 * position/rotation/scale, and the cocking slide distance) live together in
 * one typed `WeaponViewConfig` object (`DEFAULT_WEAPON_VIEW`) rather than as
 * scattered top-level constants, so the render tree (`EquationBlaster.tsx`)
 * and the live dev tool (`dev/WeaponTuningPanel.tsx`, `?tuneWeapon=1`) both
 * read/write the exact same shape.
 *
 * Asset audit — inspected via each GLB's embedded glTF JSON (node
 * hierarchy, mesh bounding box, materials), not assumed from filenames:
 *
 * - `equation-outbreak-equation-blaster.glb`: one mesh, one node, no
 *   skeleton, no separate pump object. **The purple ribbed under-barrel
 *   pump is fused into the main mesh** — see `PUMP_IS_FUSED`. Local
 *   bounding box [-0.5,0.5] x [-0.195,0.193] x [-0.081,0.082]: confirmed by
 *   rendering it in `?screen=weapon-3d-poc` that local **-X is the muzzle
 *   end**, **+X is the stock**, and local +Y is the mesh's own "up."
 *   `weaponRotation` below is a full 3-axis rotation (not a pure yaw): a
 *   pure Y-axis yaw can only ever spin between the barrel's left/right side
 *   profiles — since Y is invariant under a yaw, it can never reveal the
 *   *top* surface to a camera that never itself tilts. Revealing top+side
 *   together (and angling the barrel visibly upward toward the crosshair,
 *   not just sideways) needs the X/Z components too — see
 *   `dev/WeaponTuningPanel.tsx` and the chat history for the projection-math
 *   derivation (muzzle/stock/top/bottom bounding-box corners projected
 *   through the actual camera FOV at several aspect ratios, not eyeballed).
 * - `equation-outbreak-right-arm.glb`: a clenched fist (good for wrapping a
 *   trigger grip). Bounding box [-0.5,0.5] x [-0.459,0.457] x
 *   [-0.190,0.188] (long axis on local X), local **-X toward the
 *   fist/fingers**, **+X toward the forearm/elbow** — same "business end is
 *   the negative extreme" convention as the blaster body.
 * - `equation-outbreak-left-arm.glb`: an open, slightly-curled reaching
 *   hand with the thumb separated from the fingers, no skeleton (a single
 *   static pre-posed mesh, so cocking can only rigidly translate/rotate it
 *   as one piece, never re-pose the fingers). Bounding box
 *   [-0.334,0.338] x [-0.5,0.5] x [-0.184,0.183] (long axis on local Y),
 *   local **-Y toward the hand**, **+Y toward the forearm/elbow**.
 *
 * Every value in `DEFAULT_WEAPON_VIEW` was confirmed via the live
 * `WeaponTuningPanel` dev tool or the equivalent projection-math check
 * against the real camera FOV — not guessed from screenshots or bounding
 * boxes alone. See that file's docstring for why it exists.
 */

export type Vec3Tuple = readonly [number, number, number]

export const EQUATION_BLASTER_URL = '/models/weapons/equation-outbreak-equation-blaster.glb'
export const RIGHT_ARM_URL = '/models/weapons/equation-outbreak-right-arm.glb'
export const LEFT_ARM_URL = '/models/weapons/equation-outbreak-left-arm.glb'

/** See the module docstring — the purple ribbed pump has no separate node
 * in the current export, so it can't be moved independently of the rest
 * of the weapon mesh. `EquationBlaster` reads this to decide whether to
 * animate a separate pump node during cocking or dip/rotate the whole
 * weapon instead — kept as a named flag (not a magic boolean inline) so a
 * future re-export with a real separate pump node only has to flip this
 * and provide `PUMP_LOCAL_POSITION`. */
export const PUMP_IS_FUSED = true

/**
 * Every tunable transform for the weapon's first-person presentation and
 * both arms — the single shape shared by `EquationBlaster`'s default props,
 * `WeaponTuningPanel`'s live editor, and its "copy as config" JSON export.
 * Rotations are radians here (matching Three.js `rotation` props directly);
 * the panel converts to/from degrees only at its own UI boundary.
 */
export interface WeaponViewConfig {
  /** Where the whole assembly sits in camera-local space. */
  weaponPosition: Vec3Tuple
  /** Full 3-axis rotation from the raw mesh's local space to its on-screen
   * presentation — see the module docstring for why this can't be a pure
   * yaw. */
  weaponRotation: Vec3Tuple
  /** Uniform scale applied to the imported (1-unit-long) blaster mesh. */
  weaponScale: number
  /** Muzzle anchor, in *unscaled* blaster-local space — the visual barrel
   * tip, inset slightly from the raw bounding-box extreme (which includes
   * the rounded end cap) and offset to the barrel's own centerline rather
   * than the mesh's geometric center. Always transformed by
   * `weaponScale`/`weaponRotation` at render time (it's a child of the same
   * group), never hardcoded post-transform. */
  muzzlePosition: Vec3Tuple
  /** Grip anchor for the right (trigger) hand, in unscaled blaster-local
   * space. */
  rightGripPosition: Vec3Tuple
  rightArmRotation: Vec3Tuple
  rightArmScale: number
  /** Resting (post-cocking / pre-cocking) anchor for the left (support)
   * hand, under the barrel around the fused pump's location. */
  leftGripPosition: Vec3Tuple
  leftArmRotation: Vec3Tuple
  leftArmScale: number
  /** How far (world units, post-`weaponScale`) the left hand — and the
   * pump too, if a future export gives it a separate movable node — slides
   * back during the first half of cocking, along the barrel's own actual
   * on-screen direction (see `STOCKWARD_DIRECTION` in
   * `EquationBlaster.tsx`), never a raw camera axis. */
  cockingSlideDistance: number
}

export const DEFAULT_WEAPON_VIEW: WeaponViewConfig = {
  weaponPosition: [0.16, -0.22, -0.665],
  weaponRotation: [-0.384, -1.0647, -0.2801],
  weaponScale: 0.46,
  muzzlePosition: [-0.48, 0.065, 0],
  rightGripPosition: [0.425, -0.25, -0.16],
  rightArmRotation: [-0.4712, -0.6283, -0.1222],
  rightArmScale: 0.34,
  leftGripPosition: [-0.205, -0.305, 0.14],
  leftArmRotation: [-0.733, 0.1745, 0.192],
  leftArmScale: 0.34,
  cockingSlideDistance: 0.11,
}

/** How far the whole weapon dips/rotates during cocking to sell the
 * motion while the pump stays fused to the main mesh — added on top of
 * `weaponRotation`'s own baseline X component, never replacing it (the
 * baseline tilt is part of the weapon's on-screen presentation, not
 * something cocking should ever momentarily discard). */
export const COCKING_WEAPON_DIP_RADIANS = 0.19

/** Base recoil kick at `WeaponDefinition.recoilStrength === 1` — the actual
 * per-shot kick is this times the selected weapon's own `recoilStrength`,
 * and its duration comes from that same weapon's `recoilDurationMs` (see
 * `lib/weaponDefinitions.ts`), so recoil *feel* stays a weapon property
 * while these stay this asset's own geometric limits. Bumped up from the
 * original 0.05/0.16 rad, which — combined with the old recoilStrength of
 * 0.4 — was too small to actually see against the weapon's own large
 * presentation tilt. */
export const RECOIL_KICK_DISTANCE = 0.09
export const RECOIL_KICK_PITCH_RADIANS = 0.32

export const IDLE_SWAY_AMPLITUDE = 0.012
/** Per-frame `quaternion.slerp` factor the aim-follow uses to smoothly
 * converge the weapon's muzzle direction onto the actual camera ray toward
 * the crosshair every `useFrame` tick (see `computeAimQuaternion` in
 * `EquationBlaster.tsx`) — high enough to feel responsive, low enough to
 * still read as a smooth follow rather than snapping instantly to the
 * cursor. There's no separate "how far should it swing" constant anymore:
 * an earlier version scaled `aimNdc` by hand-picked yaw/pitch maximums,
 * which is an eyeballed approximation of "points at the crosshair" and
 * kept being wrong. The aim direction is now derived from the camera's own
 * FOV/aspect (the same geometry the camera itself uses), so the barrel
 * actually points at the crosshair by construction — this factor only
 * controls how quickly it catches up, nothing about direction or amount. */
export const AIM_FOLLOW_SMOOTHING = 0.2
