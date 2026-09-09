/**
 * Typed character-definition abstraction for Equation Outbreak's 3D
 * renderer. The scene/renderer consumes a `CharacterDefinition` rather than
 * depending on the scientist-zombie GLB directly, so a future reskin (a
 * robot, an alien, a second zombie variant) is a matter of registering a new
 * entry here — no changes to `ZombieCharacter3D`, the wave engine, or the
 * scene's lane/hitbox/label logic.
 *
 * This is intentionally a small typed registry, not a full asset-management
 * system — that would be scope this task explicitly excludes (see the
 * "Future progression extension points" note in the delivery report for
 * where a real backend-driven catalog would eventually plug in).
 */

export interface CharacterAnimationClips {
  idle: string
  approach: string
  hitReact: string
  deadHeadshot: string
  deadBody: string
  reach: string
}

/** All values here are in *final scene units* — i.e. already accounting for
 * `CharacterDefinition.scale` — not the model's own pre-scale local space.
 * Ground truth for a given model should be read off its rendered height
 * (e.g. via the dev POC scene at `?screen=zombie-3d-poc`), not assumed. */
export interface CharacterHitboxSizing {
  headCenterY: number
  headRadius: number
  torsoCenterY: number
  torsoRadius: number
  torsoHeight: number
}

export interface CharacterAttribution {
  toolOrSource: string
  license: string
  licenseUrl: string
  attributionText: string
  dateAcquired: string
  localPath: string
}

export interface CharacterDefinition {
  id: string
  displayName: string
  modelUrl: string
  /** Corrects whatever export-time scale mismatch the source GLB has (see
   * the asset audit) to the scene's ~1.4-unit target height. */
  scale: number
  rotationYRadians: number
  yOffset: number
  headBoneName: string
  torsoBoneName: string
  clips: CharacterAnimationClips
  hitbox: CharacterHitboxSizing
  /** Y position (final scene units, same space as `hitbox`) where the
   * answer label should anchor — typically just above the head. */
  answerLabelYOffset: number
  /** Whether per-instance material tinting is safe (see ZombieCharacter3D —
   * tinting must clone the material rather than mutate the shared one). */
  supportsTint: boolean
  attribution: CharacterAttribution
}

export const SCIENTIST_ZOMBIE: CharacterDefinition = {
  id: 'scientist_zombie',
  displayName: 'Scientist Zombie',
  modelUrl: '/models/zombies/equation-outbreak-scientist-rigged.glb',
  scale: 1.4,
  rotationYRadians: 0,
  yOffset: 0,
  headBoneName: 'Head',
  torsoBoneName: 'Spine01',
  clips: {
    idle: 'Happy_Sway_Standing',
    approach: 'Mummy_Stagger',
    hitReact: 'Hit_Reaction',
    deadHeadshot: 'Dead',
    deadBody: 'dying_backwards',
    reach: 'Right_Hand_Sword_Slash',
  },
  // Measured against the dev POC scene's 1-unit reference cube at the
  // corrected scale=1.4 (the character stands ~1.6 units tall, feet at
  // Y=0 — head/hair around Y=1.4-1.6, chest around Y=0.9-1.2, hips/legs
  // below that). An earlier attempt (headCenterY 1.28, torsoCenterY 0.72)
  // put both hitboxes too low and every click missed; confirmed live via a
  // temporary oversized wireframe sphere that headCenterY=1.4 sits right on
  // the head. torsoCenterY/torsoRadius below are confirmed working via a
  // real registered hit during manual browser testing; headRadius is sized
  // the same as the confirmed torso for consistency but hasn't itself had a
  // confirmed successful headshot click yet — worth a quick follow-up pass.
  hitbox: { headCenterY: 1.4, headRadius: 0.3, torsoCenterY: 0.82, torsoRadius: 0.3, torsoHeight: 0.35 },
  // headCenterY (1.4) + headRadius (0.3) puts the top of the head at ~1.7;
  // this leaves a visible gap above that (rather than just clearing it) so
  // the label floats above the head with no overlap, including the hair.
  answerLabelYOffset: 2.5,
  supportsTint: true,
  attribution: {
    toolOrSource: 'Meshy AI',
    license: 'CC BY 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    attributionText: 'Scientist zombie model generated with Meshy AI and used under CC BY 4.0.',
    dateAcquired: '2026-09-09',
    localPath: 'frontend/public/models/zombies/equation-outbreak-scientist-rigged.glb',
  },
}

export const CHARACTER_DEFINITIONS: Record<string, CharacterDefinition> = {
  [SCIENTIST_ZOMBIE.id]: SCIENTIST_ZOMBIE,
}

export const DEFAULT_CHARACTER_ID = SCIENTIST_ZOMBIE.id
