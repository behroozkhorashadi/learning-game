import { useState } from 'react'
import type { PieceBody, PieceRecord } from '@app/api/pieces_schema.pure.lib.ts'
import { errorMessage } from '@app/query/query_state.pure.lib.ts'
import { useScheduled } from '@app/timing/use_scheduled.pure.hook.ts'
import type { CoachStatus } from './coach_questions.pure.lib.ts'
import { COACH_THINKING_MS, type WritingGameDeps } from './writing_game_state.pure.lib.ts'

export interface RevisionPass {
  readonly status: CoachStatus
  /** The text being revised. */
  readonly text: string
  readonly setText: (text: string) => void
  /** Whether the kid has changed anything since the pass began (the gate for the picture). */
  readonly changed: boolean
  readonly saving: boolean
  readonly error: string | null
  /** Starts the coached pass over `draft`: the coach thinks, then asks. */
  readonly begin: (draft: string) => void
  /**
   * Saves the piece, then the game's own records (`afterCreate`: remixes,
   * turns), then the revision pass. Resolves to the saved piece, or null if
   * saving failed (the error is shown and the kid can try again).
   */
  readonly finish: (piece: PieceBody, questionsAsked: readonly string[], afterCreate?: (pieceId: string) => Promise<void>) => Promise<PieceRecord | null>
}

/** The coached revision pass every writing game ends with, then the save. */
export function useRevisionPass({ pieces, timers }: Pick<WritingGameDeps, 'pieces' | 'timers'>): RevisionPass {
  const [status, setStatus] = useState<CoachStatus>('thinking')
  const [text, setText] = useState('')
  const [startedFrom, setStartedFrom] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scheduled = useScheduled(timers)

  return {
    status,
    text,
    setText,
    changed: text !== startedFrom,
    saving,
    error,
    begin: (draft) => {
      setStartedFrom(draft)
      setText(draft)
      setStatus('thinking')
      scheduled.after(COACH_THINKING_MS, () => {
        setStatus('questions')
      })
    },
    finish: async (piece, questionsAsked, afterCreate) => {
      setSaving(true)
      setError(null)
      try {
        const created = await pieces.create(piece)
        if (afterCreate !== undefined) await afterCreate(created.id)
        await pieces.addRevision(created.id, { questions_asked: questionsAsked, changed: text !== startedFrom })
        setStatus('done')
        return created
      } catch (err) {
        setError(errorMessage(err))
        return null
      } finally {
        setSaving(false)
      }
    },
  }
}
