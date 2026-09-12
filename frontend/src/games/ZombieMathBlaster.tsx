import { useMemo } from 'react'
import type { AttemptCreate, Item } from '../types/generated'
import { ZombieArena } from './framework/ZombieArena'
import type { QuestionResult, ZombieArenaBrain } from './framework/zombieArenaTypes'

/**
 * Equation Outbreak (internal game id remains `fact_fluency` — see
 * fact_fluency.py's docstring; nothing server-side or in the wave engine is
 * renamed). This component is the `fact_fluency` "brain" plugged into the
 * generic `ZombieArena` (see `framework/ZombieArena.tsx`) — it only knows
 * how to read a fact-fluency item payload, render the equation, and persist
 * a resolved round as an attempt. Everything about the shooting-gallery
 * mechanic itself lives in the arena.
 */

const GAME_ID = 'fact_fluency'
const SESSION_LENGTH = 5
const STARTING_LIVES = 3

type FactPayload = {
  left: number
  operator: string
  right: number
  answer: number
  options: number[]
  approach_ms: number
}

function factPayload(item: Item): FactPayload {
  return item.payload as unknown as FactPayload
}

function factText(payload: FactPayload): string {
  return `${payload.left} ${payload.operator} ${payload.right} = ${payload.answer}`
}

interface Props {
  profileId: number
  profileName?: string
  onBack: () => void
}

export function ZombieMathBlaster({ profileId, onBack }: Props) {
  const brain: ZombieArenaBrain = useMemo(
    () => ({
      gameId: GAME_ID,
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
      getApproachMs: (item) => factPayload(item).approach_ms,
      mapToOptions: (item) => {
        const payload = factPayload(item)
        return payload.options.map((value, i) => ({ id: `${item.item_id}-${i}`, label: String(value), correct: value === payload.answer }))
      },
      renderQuestion: (item) => {
        const payload = factPayload(item)
        return <>{`${payload.left} ${payload.operator} ${payload.right} =`}</>
      },
      questionSummary: (item) => factText(factPayload(item)),
      onQuestionResult: (item, result: QuestionResult, sessionId) => {
        const payload: AttemptCreate = {
          item_id: item.item_id,
          profile_id: profileId,
          game_id: item.game_id,
          session_id: sessionId,
          telemetry: { correct: result.correct, hints_used: result.wrongShots, time_ms: Math.round(result.timeTakenMs) },
          details: { wrong_shots: result.wrongShots },
        }
        fetch('/api/attempts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }).catch((err) => console.error('POST /api/attempts failed', err))
      },
    }),
    [profileId],
  )

  return <ZombieArena profileId={profileId} onBack={onBack} brain={brain} />
}
