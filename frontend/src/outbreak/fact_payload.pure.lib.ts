import { z } from 'zod'

/**
 * The arithmetic fact both zombie games play (the backend's `fact_fluency`
 * and `zombie_horde` items): `left operator right = answer`, with one term
 * missing for the kid to pick. Up to level 10 it's the answer ("3 + 4 ="); the
 * levels after ×/÷ leave out an operand instead, solving for x ("If x + 3 = 7,
 * x =").
 */

export const factPayloadSchema = z.object({
  left: z.number(),
  operator: z.string(),
  right: z.number(),
  answer: z.number(),
  /** Absent on items served before solving for x existed: those are all plain facts. */
  missing: z.enum(['answer', 'left', 'right']).default('answer'),
  options: z.array(z.number()).min(4),
  approach_ms: z.number().positive(),
})

export type FactPayload = z.infer<typeof factPayloadSchema>

/** What the kid picks: the answer, or the operand standing in for x. */
export function factValue(fact: FactPayload): number {
  switch (fact.missing) {
    case 'answer':
      return fact.answer
    case 'left':
      return fact.left
    case 'right':
      return fact.right
    default:
      return assertNever(fact.missing)
  }
}

function equation(fact: FactPayload, x: 'left' | 'right'): string {
  const left = x === 'left' ? 'x' : String(fact.left)
  const right = x === 'right' ? 'x' : String(fact.right)
  return `${left} ${fact.operator} ${right} = ${String(fact.answer)}`
}

/** The on-screen question, which the picked value completes: "3 + 4 =" or "If x + 3 = 7, x =". */
export function factText(fact: FactPayload): string {
  if (fact.missing === 'answer') return `${String(fact.left)} ${fact.operator} ${String(fact.right)} =`
  return `If ${equation(fact, fact.missing)}, x =`
}

/** The solved item, for the announcement and the recap: "3 + 4 = 7" or "x + 3 = 7, so x = 4". */
export function factSummary(fact: FactPayload): string {
  if (fact.missing === 'answer') return `${String(fact.left)} ${fact.operator} ${String(fact.right)} = ${String(fact.answer)}`
  return `${equation(fact, fact.missing)}, so x = ${String(factValue(fact))}`
}

function assertNever(value: never): never {
  throw new Error(`Unexpected missing term: ${String(value)}`)
}
