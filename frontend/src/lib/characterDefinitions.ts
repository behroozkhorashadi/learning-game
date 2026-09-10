/**
 * Typed character-definition abstraction for Equation Outbreak's 3D
 * renderer. The scene/renderer consumes `CharacterDefinition`s rather than
 * depending on any specific GLB directly, so a new zombie is a matter of
 * registering one more entry here — no changes to `ZombieCharacter3D`, the
 * wave engine, or the scene's lane/hitbox/label logic. This is what lets
 * the roster grow toward the eventual 20+-character pool
 * (`lib/zombieRoster.ts` picks a session's four from whatever's `enabled`
 * here) without touching gameplay code.
 *
 * All four GLBs currently in `public/models/zombies/` were inspected
 * directly (via the GLB's embedded glTF JSON chunk — mesh/triangle counts,
 * skins, animation clip names, materials/textures, node hierarchy) rather
 * than assumed. They turned out to share one Meshy AI export template:
 * identical 24-joint skeleton and bone names, identical bind-pose height
 * (~1.4 units before this file's `scale` correction), identical animation
 * clip names, and a single skinned mesh + single material each (no
 * separate node for a held prop — see each entry's `heldProp` for what
 * that prop visually is, baked into the base mesh rather than attachable).
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

/** Purely descriptive — none of the four current GLBs expose a separate,
 * attachable prop node (single mesh, single material each), so there is no
 * node to hide/show or reparent. A held item is already baked into the
 * character's own skinned mesh, which means it's automatically "part of
 * its corresponding character" for free: every instance is its own
 * `SkeletonUtils` clone of the whole mesh, so the prop can never detach,
 * duplicate, or leak into another instance. */
export interface HeldPropInfo {
  label: string
  description: string
}

export interface CharacterDefinition {
  id: string
  displayName: string
  modelUrl: string
  /** Session roster selection (`lib/zombieRoster.ts`) only ever considers
   * characters with `enabled: true` — set false to keep a GLB registered
   * (e.g. mid-import, or temporarily pulled) without deleting its entry. */
  enabled: boolean
  scale: number
  rotationYRadians: number
  /** Ground-position correction along Y (final scene units) — all four
   * current GLBs already bind-pose with feet at y≈0, so this is 0 for all
   * of them today, but stays per-character for a future model that doesn't. */
  yOffset: number
  headBoneName: string
  torsoBoneName: string
  rootBoneName: string
  clips: CharacterAnimationClips
  hitbox: CharacterHitboxSizing
  answerLabelYOffset: number
  supportsTint: boolean
  heldProp?: HeldPropInfo
  attribution: CharacterAttribution
}

/** Every current GLB embeds this exact set of clip names (verified by
 * inspecting each file's glTF JSON `animations` array — not assumed): the
 * six gameplay clips below, plus `Armature|clip0|baselayer`, `Running`, and
 * `Walking`, which no gameplay role currently maps to. The scientist model
 * additionally has `Basic_Jump` and `Sleep_Normally`, also unused. Because
 * every character happens to share identical naming today, all four
 * entries below use the same mapping — but the mapping is still
 * per-character data, not a shared constant, so a future model with
 * different embedded names (spaces, different casing, a synonym) is just a
 * different value here, not a code change. See `lib/zombieAnimationFallback.ts`
 * for what happens if a future entry's mapped name turns out to be wrong. */
const MESHY_TEMPLATE_CLIPS: CharacterAnimationClips = {
  idle: 'Happy_Sway_Standing',
  approach: 'Mummy_Stagger',
  hitReact: 'Hit_Reaction',
  deadHeadshot: 'Dead',
  deadBody: 'dying_backwards',
  reach: 'Right_Hand_Sword_Slash',
}

/** Shared by every current GLB — same 24-joint rig, same bind-pose scale
 * (confirmed by direct inspection of each file's mesh bounding box), same
 * proportions close enough that per-character hitbox tuning isn't needed
 * yet. A future character with meaningfully different proportions should
 * get its own `hitbox`/`scale` values rather than reusing this constant. */
const MESHY_TEMPLATE_HITBOX: CharacterHitboxSizing = { headCenterY: 1.4, headRadius: 0.3, torsoCenterY: 0.82, torsoRadius: 0.3, torsoHeight: 0.35 }

function meshyAttribution(localPath: string, dateAcquired: string, attributionText: string): CharacterAttribution {
  return {
    toolOrSource: 'Meshy AI',
    license: 'CC BY 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    attributionText,
    dateAcquired,
    localPath,
  }
}

export const SCIENTIST_ZOMBIE: CharacterDefinition = {
  id: 'scientist_zombie',
  displayName: 'Scientist Zombie',
  modelUrl: '/models/zombies/equation-outbreak-scientist-rigged.glb',
  enabled: true,
  scale: 1.4,
  rotationYRadians: 0,
  yOffset: 0,
  headBoneName: 'Head',
  torsoBoneName: 'Spine01',
  rootBoneName: 'Hips',
  clips: MESHY_TEMPLATE_CLIPS,
  hitbox: MESHY_TEMPLATE_HITBOX,
  answerLabelYOffset: 2.5,
  supportsTint: true,
  attribution: meshyAttribution(
    'frontend/public/models/zombies/equation-outbreak-scientist-rigged.glb',
    '2026-09-09',
    'Scientist zombie model generated with Meshy AI and used under CC BY 4.0.',
  ),
}

export const HOCKEY_ZOMBIE: CharacterDefinition = {
  id: 'hockey_zombie',
  displayName: 'Hockey Zombie',
  modelUrl: '/models/zombies/equation-outbreak-hockey-rigged.glb',
  enabled: true,
  scale: 1.4,
  rotationYRadians: 0,
  yOffset: 0,
  headBoneName: 'Head',
  torsoBoneName: 'Spine01',
  rootBoneName: 'Hips',
  clips: MESHY_TEMPLATE_CLIPS,
  hitbox: MESHY_TEMPLATE_HITBOX,
  answerLabelYOffset: 2.5,
  supportsTint: true,
  heldProp: { label: 'Hockey stick', description: 'Baked into the base mesh — no separate attachable node.' },
  attribution: meshyAttribution(
    'frontend/public/models/zombies/equation-outbreak-hockey-rigged.glb',
    '2026-09-10',
    'Hockey zombie model generated with Meshy AI and used under CC BY 4.0.',
  ),
}

export const SKATER_ZOMBIE: CharacterDefinition = {
  id: 'skater_zombie',
  displayName: 'Skater Zombie',
  modelUrl: '/models/zombies/equation-outbreak-skater-rigged.glb',
  enabled: true,
  scale: 1.4,
  rotationYRadians: 0,
  yOffset: 0,
  headBoneName: 'Head',
  torsoBoneName: 'Spine01',
  rootBoneName: 'Hips',
  clips: MESHY_TEMPLATE_CLIPS,
  hitbox: MESHY_TEMPLATE_HITBOX,
  answerLabelYOffset: 2.5,
  supportsTint: true,
  // No `heldProp`: confirmed via the dev POC scene (?screen=zombie-3d-poc)
  // across every clip — despite the filename, this character wears skate
  // gear (beanie, pads, skate shoes) but doesn't actually hold a board.
  attribution: meshyAttribution(
    'frontend/public/models/zombies/equation-outbreak-skater-rigged.glb',
    '2026-09-10',
    'Skater zombie model generated with Meshy AI and used under CC BY 4.0.',
  ),
}

export const SPORTY_ZOMBIE: CharacterDefinition = {
  id: 'sporty_zombie',
  displayName: 'Sporty Zombie',
  modelUrl: '/models/zombies/equation-outbreak-sporty-rigged.glb',
  enabled: true,
  scale: 1.4,
  rotationYRadians: 0,
  yOffset: 0,
  headBoneName: 'Head',
  torsoBoneName: 'Spine01',
  rootBoneName: 'Hips',
  clips: MESHY_TEMPLATE_CLIPS,
  hitbox: MESHY_TEMPLATE_HITBOX,
  answerLabelYOffset: 2.5,
  supportsTint: true,
  // No `heldProp`: confirmed via the dev POC scene — a backwards cap,
  // backpack straps, and a hoodie, but no held item in either hand.
  attribution: meshyAttribution(
    'frontend/public/models/zombies/equation-outbreak-sporty-rigged.glb',
    '2026-09-10',
    'Sporty zombie model generated with Meshy AI and used under CC BY 4.0.',
  ),
}

/** The full zombie character registry — the single place a new character
 * gets added. `lib/zombieRoster.ts`'s `selectSessionRoster` reads this
 * (filtered to `enabled`) and nothing else; rendering and wave logic never
 * hardcode a character. */
export const ZOMBIE_CHARACTER_REGISTRY: CharacterDefinition[] = [SCIENTIST_ZOMBIE, HOCKEY_ZOMBIE, SKATER_ZOMBIE, SPORTY_ZOMBIE]

export const CHARACTER_DEFINITIONS: Record<string, CharacterDefinition> = Object.fromEntries(ZOMBIE_CHARACTER_REGISTRY.map((c) => [c.id, c]))

export const DEFAULT_CHARACTER_ID = SCIENTIST_ZOMBIE.id
