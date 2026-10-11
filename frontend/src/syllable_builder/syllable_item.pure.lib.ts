import { z } from 'zod'
import type { BoardItem } from '@app/tiles/tile_placement.pure.lib.ts'
import type { PracticeConfig } from '@app/practice/practice_state.pure.lib.ts'

export const SYLLABLE_GAME_ID = 'syllable_builder'

/** The payload backend/app/games/syllable_builder.py serves. */
export const syllablePayloadSchema = z
  .object({
    target_word: z.string(),
    correct_syllables: z.array(z.string()).readonly(),
    tiles: z.array(z.string()).readonly(),
  })
  .readonly()

export type SyllablePayload = z.infer<typeof syllablePayloadSchema>

export function parseSyllablePayload(payload: unknown): SyllablePayload {
  const result = syllablePayloadSchema.safeParse(payload)
  if (!result.success) throw new Error(`syllable_builder item has an unexpected payload: ${result.error.message}`)
  return result.data
}

export function syllableBoard(payload: SyllablePayload): BoardItem {
  return {
    kind: 'word',
    instruction: 'Put the sounds in order to build the word',
    spoken: payload.target_word,
    slots: payload.correct_syllables.length,
    answer: payload.correct_syllables,
    // Ids must be unique even when a syllable repeats (to-ma-to): the board tracks placement by id.
    tiles: payload.tiles.map((syllable, i) => ({ id: `${syllable}-${String(i)}`, label: syllable })),
  }
}

/** PRD "Session flow": a set number of items, matching the design's "make five words". Ends with the paper handoff. */
export const SYLLABLE_CONFIG: PracticeConfig<SyllablePayload> = {
  sessionLength: 5,
  handoff: true,
  label: (payload) => payload.target_word,
  details: (_payload, placement) => ({ assembled: placement }),
}
