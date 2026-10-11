import type { EquationPayload } from './equation_item.pure.lib.ts'

export function equation(answer: number, tiles: readonly string[]): EquationPayload {
  return { left: 3, operator: '+', right: answer - 3, answer, missing: 'answer', tiles }
}

export const SESSION_EQUATIONS: readonly EquationPayload[] = [equation(7, ['7', '8']), equation(9, ['9', '10']), equation(6, ['6', '5']), equation(5, ['5', '4']), equation(12, ['12', '11'])]
