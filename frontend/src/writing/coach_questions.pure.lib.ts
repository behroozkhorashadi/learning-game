/** What the revision coach asks, and where it is in its pass. */

export type CoachQuestionKind = 'opening' | 'wordChoice' | 'feeling'
export type CoachStatus = 'thinking' | 'questions' | 'done'

export interface CoachQuestion {
  readonly id: string
  readonly kind: CoachQuestionKind
  readonly text: string
  readonly answered?: boolean
}
