import { z } from 'zod'
import type { ItemRecord } from '@app/api/practice_schema.pure.lib.ts'
import type { HordeQuestion } from './horde_engine.pure.lib.ts'

/**
 * Reads a Zombie Horde item (the backend's `zombie_horde` game: Fact
 * Fluency's arithmetic facts under their own id) into the engine's question.
 *
 * `approach_ms` is the server's pace for this kid's level (shorter is harder).
 * Here it sets how long a zombie takes to cross the whole field.
 */

export const HORDE_GAME_ID = 'zombie_horde'

/** A zombie crosses the field in this many times the item's approach time: 9s at level 1 becomes 54s. */
const TRAVEL_FACTOR = 6

const factPayloadSchema = z.object({
  left: z.number(),
  operator: z.string(),
  right: z.number(),
  answer: z.number(),
  options: z.array(z.number()).min(4),
  approach_ms: z.number().positive(),
})

/** Throws on a payload that isn't an arithmetic fact with at least four options. */
export function hordeQuestion(item: ItemRecord): HordeQuestion {
  const parsed = factPayloadSchema.safeParse(item.payload)
  if (!parsed.success) throw new Error(`Item ${item.item_id} isn't an arithmetic fact: ${parsed.error.message}`)
  const { left, operator, right, answer, options } = parsed.data
  return {
    id: item.item_id,
    text: `${String(left)} ${operator} ${String(right)} =`,
    summary: `${String(left)} ${operator} ${String(right)} = ${String(answer)}`,
    options: options.map((value) => ({ label: String(value), correct: value === answer })),
  }
}

/** How long a zombie takes to cross the field, from the item's pace. Throws like `hordeQuestion`. */
export function travelMsFor(item: ItemRecord): number {
  const parsed = factPayloadSchema.safeParse(item.payload)
  if (!parsed.success) throw new Error(`Item ${item.item_id} isn't an arithmetic fact: ${parsed.error.message}`)
  return parsed.data.approach_ms * TRAVEL_FACTOR
}
