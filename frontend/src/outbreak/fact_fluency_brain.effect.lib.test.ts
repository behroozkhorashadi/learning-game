import { describe, expect, it } from 'vitest'
import type { AttemptBody } from '@app/api/practice_schema.pure.lib.ts'
import { bindFactFluencyBrain, factQuestion } from './fact_fluency_brain.effect.lib.ts'

const ITEM = { item_id: 'i1', game_id: 'fact_fluency', level: 2, variant_id: null, payload: { left: 3, operator: '+', right: 4, answer: 7, options: [6, 7, 8, 5], approach_ms: 8000 } }

describe('factQuestion', () => {
  it('reads the equation, its four options, and the approach time', () => {
    expect(factQuestion(ITEM)).toEqual({
      approachMs: 8000,
      options: [
        { id: 'i1-0', label: '6', correct: false },
        { id: 'i1-1', label: '7', correct: true },
        { id: 'i1-2', label: '8', correct: false },
        { id: 'i1-3', label: '5', correct: false },
      ],
      text: '3 + 4 =',
      summary: '3 + 4 = 7',
    })
  })

  it("refuses a payload that isn't a fact question", () => {
    expect(() => factQuestion({ ...ITEM, payload: { left: 3 } })).toThrow("isn't a fact-fluency question")
  })
})

describe('bindFactFluencyBrain', () => {
  it('records each resolved round as an attempt, wrong shots as hints', () => {
    const attempts: AttemptBody[] = []
    const brain = bindFactFluencyBrain({
      recordAttempt: (attempt) => {
        attempts.push(attempt)
        return Promise.resolve()
      },
      reportError: () => undefined,
    })
    brain.onQuestionResult(ITEM, { correct: false, timeTakenMs: 1234.6, wrongShots: 1 }, { profileId: 2, sessionId: 's1' })
    expect(attempts).toEqual([
      { item_id: 'i1', profile_id: 2, game_id: 'fact_fluency', session_id: 's1', telemetry: { correct: false, hints_used: 1, time_ms: 1235 }, details: { wrong_shots: 1 } },
    ])
  })

  it('reports a failed save instead of interrupting play', async () => {
    const reported: string[] = []
    const brain = bindFactFluencyBrain({ recordAttempt: () => Promise.reject(new Error('offline')), reportError: (message) => reported.push(message) })
    brain.onQuestionResult(ITEM, { correct: true, timeTakenMs: 1, wrongShots: 0 }, { profileId: 2, sessionId: 's1' })
    await Promise.resolve()
    await Promise.resolve()
    expect(reported).toEqual(['POST /api/attempts failed'])
  })
})
