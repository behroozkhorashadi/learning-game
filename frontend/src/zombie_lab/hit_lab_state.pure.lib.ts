import { z } from 'zod'
import type { CharacterDefinition } from '@app/zombies/character_definitions.pure.lib.ts'

/**
 * The hit lab's data (zombie_hit_lab.effect.ui.tsx is the screen): a labeled
 * shot is a setup (character, lane, distance, frozen pose), where it was
 * aimed, what the game's hit logic decided, and what a person says it should
 * have been. Pure, so the scoring and the setup parsing are tested without
 * a scene.
 */

export const OUTCOMES = ['head', 'body', 'miss'] as const
export type Outcome = (typeof OUTCOMES)[number]

const outcomeSchema = z.enum(OUTCOMES)

const labConfigShape = {
  characterId: z.string(),
  lane: z.number().int().min(0).max(3),
  distance: z.number().min(0).max(1),
  poseTime: z.number().min(0),
}

export const labShotSchema = z.object({
  ...labConfigShape,
  id: z.string(),
  ndc: z.object({ x: z.number(), y: z.number() }).readonly(),
  expected: outcomeSchema.nullable(),
  /** What the hit logic said when the shot was taken. */
  recorded: outcomeSchema,
  /** What the hit logic says after the latest Re-score, if one ran. */
  rescored: outcomeSchema.optional(),
  /** What the game's own R3F pointer handlers reported for the live click: should equal `recorded`; a difference means the lab's replay raycast drifted from the real event path. */
  live: outcomeSchema.optional(),
})

export type LabShot = z.infer<typeof labShotSchema>
export type LabConfig = Pick<LabShot, 'characterId' | 'lane' | 'distance' | 'poseTime'>

/** Saved shots (localStorage) or an imported file: a list, or a `{ shots }` document. Anything unreadable is no shots. */
export function parseShots(text: string | null): readonly LabShot[] {
  if (text === null) return []
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return []
  }
  const list = z.union([z.array(labShotSchema), z.object({ shots: z.array(labShotSchema) }).transform((doc) => doc.shots)]).safeParse(raw)
  return list.success ? list.data : []
}

/** The fixture document "Download JSON" writes, labeled shots only. */
export function exportDocument(shots: readonly LabShot[], aspect: number): string {
  return JSON.stringify({ version: 1, aspect, shots: shots.filter((s) => s.expected !== null) }, null, 2)
}

/** The starting setup, from the URL (`&character=&lane=&distance=&pose=`) so the e2e eval can open each labeled setup directly. */
export function labConfigFromSearch(search: string, fallbackCharacter: CharacterDefinition): LabConfig {
  const params = new URLSearchParams(search)
  const num = (key: string, fallback: number): number => {
    const value = Number(params.get(key) ?? Number.NaN)
    return Number.isFinite(value) ? value : fallback
  }
  return { characterId: params.get('character') ?? fallbackCharacter.id, lane: num('lane', 1), distance: num('distance', 0.5), poseTime: num('pose', 0.5) }
}

export function sameConfig(a: LabConfig, b: LabConfig): boolean {
  return a.characterId === b.characterId && a.lane === b.lane && a.distance === b.distance && a.poseTime === b.poseTime
}

/** Every distinct setup among `shots`, in first-seen order. */
export function distinctConfigs(shots: readonly LabShot[]): readonly LabConfig[] {
  const configs: LabConfig[] = []
  for (const s of shots) if (!configs.some((c) => sameConfig(c, s))) configs.push({ characterId: s.characterId, lane: s.lane, distance: s.distance, poseTime: s.poseTime })
  return configs
}

export function currentOutcome(shot: LabShot): Outcome {
  return shot.rescored ?? shot.recorded
}

export function isHit(outcome: Outcome): boolean {
  return outcome !== 'miss'
}

/** A new shot. An unlabeled previous shot is dropped: every saved shot carries a label. */
export function addShot(shots: readonly LabShot[], shot: LabShot): readonly LabShot[] {
  return [...shots.filter((s) => s.expected !== null), shot]
}

/** Labels the shot waiting for one, if any. */
export function labelPending(shots: readonly LabShot[], expected: Outcome): readonly LabShot[] {
  const pending = shots.find((s) => s.expected === null)
  return pending === undefined ? shots : shots.map((s) => (s === pending ? { ...s, expected } : s))
}

export interface LabScore {
  readonly labeled: number
  readonly hitMissAgree: number
  /** Should have hit, but the game said miss. */
  readonly falseMisses: number
  /** Should have missed, but the game said hit. */
  readonly falseHits: number
  /** Both hits, but head and body swapped. */
  readonly zoneWrong: number
}

/** Scoring over labeled shots, against the latest outcome (re-scored if run). */
export function scoreShots(shots: readonly LabShot[]): LabScore {
  let labeled = 0
  let hitMissAgree = 0
  let falseMisses = 0
  let falseHits = 0
  let zoneWrong = 0
  for (const s of shots) {
    if (s.expected === null) continue
    labeled += 1
    const outcome = currentOutcome(s)
    if (isHit(s.expected) === isHit(outcome)) hitMissAgree += 1
    if (isHit(s.expected) && !isHit(outcome)) falseMisses += 1
    if (!isHit(s.expected) && isHit(outcome)) falseHits += 1
    if (isHit(s.expected) && isHit(outcome) && s.expected !== outcome) zoneWrong += 1
  }
  return { labeled, hitMissAgree, falseMisses, falseHits, zoneWrong }
}

export function percentOf(n: number, total: number): string {
  return total === 0 ? '—' : `${String(Math.round((n / total) * 100))}%`
}

/** The Playwright eval's fixture endpoint (vite.config.ts) answers with how many shots it added and now holds. */
export const appendResultSchema = z.object({ added: z.number().int(), total: z.number().int() }).readonly()
export type AppendResult = z.infer<typeof appendResultSchema>
