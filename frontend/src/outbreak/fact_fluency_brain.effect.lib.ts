import { z } from 'zod'
import type { AttemptBody } from '@app/api/practice_schema.pure.lib.ts'
import type { ItemRecord } from '@app/api/practice_schema.pure.lib.ts'
import type { ArenaQuestion, ZombieArenaBrain } from './zombie_arena_state.pure.lib.ts'

/**
 * Equation Outbreak's brain (the internal game id stays `fact_fluency`; see
 * backend fact_fluency.py, where nothing is renamed). It only knows how to
 * read a fact-fluency item, show the equation, and persist a resolved round
 * as an attempt. The shooting-gallery mechanic is the arena's.
 */

export const FACT_FLUENCY_GAME_ID = 'fact_fluency'
const SESSION_LENGTH = 10
const STARTING_LIVES = 3

const factPayloadSchema = z.object({
  left: z.number(),
  operator: z.string(),
  right: z.number(),
  answer: z.number(),
  options: z.array(z.number()).length(4),
  approach_ms: z.number().positive(),
})

/** Reads a fact-fluency item into the arena's question. Throws on a payload that isn't one. */
export function factQuestion(item: ItemRecord): ArenaQuestion {
  const parsed = factPayloadSchema.safeParse(item.payload)
  if (!parsed.success) throw new Error(`Item ${item.item_id} isn't a fact-fluency question: ${parsed.error.message}`)
  const { left, operator, right, answer, options, approach_ms } = parsed.data
  return {
    approachMs: approach_ms,
    options: options.map((value, i) => ({ id: `${item.item_id}-${String(i)}`, label: String(value), correct: value === answer })),
    text: `${String(left)} ${operator} ${String(right)} =`,
    summary: `${String(left)} ${operator} ${String(right)} = ${String(answer)}`,
  }
}

export interface FactFluencyBrainDeps {
  /** POST /api/attempts. In the app, the attempts adapter's `record`. */
  readonly recordAttempt: (attempt: AttemptBody) => Promise<unknown>
  /** Where a failed save is reported; it never interrupts play. */
  readonly reportError: (message: string, error: unknown) => void
}

export function bindFactFluencyBrain({ recordAttempt, reportError }: FactFluencyBrainDeps): ZombieArenaBrain {
  return {
    gameId: FACT_FLUENCY_GAME_ID,
    sessionLength: SESSION_LENGTH,
    startingLives: STARTING_LIVES,
    copy: {
      title: 'Equation Outbreak',
      subtitle:
        'Solve the facts. Stop the horde. An equation shows up, then a horde of silly zombies shambles toward you carrying possible answers. Zap the right one with your math blaster before they arrive — a wrong zap makes them faster!',
      sessionCompleteHeadline: 'You stopped the Equation Outbreak!',
      sessionCompleteSubtitle: 'Five facts, solved under pressure. Nice reflexes.',
      badgeTitle: 'Fact Blaster badge',
      itemsLabel: 'Facts you zapped',
      gameOverHeadline: 'The outbreak got the better of you this time!',
    },
    prepare: factQuestion,
    onQuestionResult: (item, result, { profileId, sessionId }) => {
      recordAttempt({
        item_id: item.item_id,
        profile_id: profileId,
        game_id: item.game_id,
        session_id: sessionId,
        telemetry: { correct: result.correct, hints_used: result.wrongShots, time_ms: Math.round(result.timeTakenMs) },
        details: { wrong_shots: result.wrongShots },
      }).catch((error: unknown) => {
        reportError('POST /api/attempts failed', error)
      })
    },
  }
}
