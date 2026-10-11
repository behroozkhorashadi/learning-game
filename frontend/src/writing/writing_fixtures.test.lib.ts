import type { IllustrationRecord, IllustrationRequest } from '@app/api/pieces_schema.pure.lib.ts'
import type { CoachQuestion } from './coach_questions.pure.lib.ts'

export const QUESTIONS: readonly CoachQuestion[] = [
  { id: 'opening', kind: 'opening', text: 'How does it start?', answered: false },
  { id: 'wordChoice', kind: 'wordChoice', text: 'Any word used twice?', answered: true },
]

/** Repeats "word " n times: a draft of exactly n words. */
export function words(n: number): string {
  return Array.from({ length: n }, () => 'word').join(' ')
}

/** An illustration service that returns a picture per request, or fails every time. */
export function fakeIllustrator(fail = false): {
  readonly generateIllustration: (pieceId: string, request: IllustrationRequest) => Promise<IllustrationRecord>
  readonly requests: readonly { readonly pieceId: string; readonly request: IllustrationRequest }[]
} {
  const requests: { pieceId: string; request: IllustrationRequest }[] = []
  const generateIllustration = (pieceId: string, request: IllustrationRequest): Promise<IllustrationRecord> => {
    requests.push({ pieceId, request })
    if (fail) return Promise.reject(new Error('POST illustrations/generate failed with HTTP 503'))
    return Promise.resolve({ id: requests.length, piece_id: pieceId, image_url: `/static/illustrations/${String(requests.length)}.png`, prompt_excerpt: request.prompt_excerpt, order: request.order, is_hero: request.is_hero, created_at: '' })
  }
  return { generateIllustration, requests }
}
