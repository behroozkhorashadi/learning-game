import { z } from 'zod'
import type { PracticeConfig } from '@app/practice/practice_state.pure.lib.ts'
import type { BoardItem } from '@app/tiles/tile_placement.pure.lib.ts'

export const EQUATION_GAME_ID = 'equation_builder'

/** The payload backend/app/games/equation_builder.py serves: one part of `left op right = answer` is missing. */
export const equationPayloadSchema = z
  .object({
    left: z.number(),
    operator: z.string(),
    right: z.number(),
    answer: z.number(),
    missing: z.enum(['left', 'operator', 'right', 'answer']),
    tiles: z.array(z.string()).readonly(),
  })
  .readonly()

export type EquationPayload = z.infer<typeof equationPayloadSchema>
export type EquationPart = EquationPayload['missing']

export function parseEquationPayload(payload: unknown): EquationPayload {
  const result = equationPayloadSchema.safeParse(payload)
  if (!result.success) throw new Error(`equation_builder item has an unexpected payload: ${result.error.message}`)
  return result.data
}

export function partLabel(payload: EquationPayload, part: EquationPart): string {
  return part === 'operator' ? payload.operator : String(payload[part])
}

export function equationText(payload: EquationPayload): string {
  return `${String(payload.left)} ${payload.operator} ${String(payload.right)} = ${String(payload.answer)}`
}

export function equationBoard(payload: EquationPayload): BoardItem {
  const correct = partLabel(payload, payload.missing)
  return {
    kind: 'equation',
    instruction: 'Pick the tile that completes the equation',
    spoken: correct,
    slots: 1,
    answer: [correct],
    // Index-suffixed so ids stay unique even if the tray ever repeats a label.
    tiles: payload.tiles.map((label, i) => ({ id: `${label}-${String(i)}`, label })),
  }
}

/** Fully objective: a correct placement is the whole answer, so no paper handoff (PRD §6). */
export const EQUATION_CONFIG: PracticeConfig<EquationPayload> = {
  sessionLength: 5,
  handoff: false,
  label: equationText,
  details: (payload, placement) => ({ placement, missing: payload.missing }),
}
