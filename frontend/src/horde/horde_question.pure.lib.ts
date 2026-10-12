import type { ItemRecord } from '@app/api/practice_schema.pure.lib.ts'
import { factPayloadSchema, factSummary, factText, factValue } from '@app/outbreak/fact_payload.pure.lib.ts'
import type { HordeQuestion } from './horde_engine.pure.lib.ts'

/**
 * Reads a Zombie Horde item (the backend's `zombie_horde` game: Fact
 * Fluency's arithmetic facts under their own id, solving for x at the top
 * levels) into the engine's question.
 *
 * The item's level sets how long a zombie takes to cross the field (`travelMsFor`).
 */

export const HORDE_GAME_ID = 'zombie_horde'

/**
 * How long a zombie takes to cross the field, by the item's level: 54s at
 * level 1 down to 45s at level 10 and above. Deliberately not the item's `approach_ms`
 * (Equation Outbreak's pace, which halves from level 1 to 10): a zombie takes
 * several right answers to defeat, so tying speed to the level made the top
 * levels unwinnable even with perfect aim (see horde_balance.pure.lib.test.ts).
 * The level makes the math harder; the walk barely changes.
 */
const SLOWEST_TRAVEL_MS = 54_000
const FASTEST_TRAVEL_MS = 45_000
const TOP_LEVEL = 10

/** Throws on a payload that isn't an arithmetic fact with at least four options. */
export function hordeQuestion(item: ItemRecord): HordeQuestion {
  const parsed = factPayloadSchema.safeParse(item.payload)
  if (!parsed.success) throw new Error(`Item ${item.item_id} isn't an arithmetic fact: ${parsed.error.message}`)
  const fact = parsed.data
  const value = factValue(fact)
  return {
    id: item.item_id,
    text: factText(fact),
    summary: factSummary(fact),
    options: fact.options.map((option) => ({ label: String(option), correct: option === value })),
  }
}

/** How long a zombie takes to cross the field at this item's level. */
export function travelMsFor(item: ItemRecord): number {
  const progress = Math.min(Math.max((item.level - 1) / (TOP_LEVEL - 1), 0), 1)
  return Math.round(SLOWEST_TRAVEL_MS - (SLOWEST_TRAVEL_MS - FASTEST_TRAVEL_MS) * progress)
}
