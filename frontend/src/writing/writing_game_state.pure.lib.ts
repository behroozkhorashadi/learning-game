import type { PieceBody, PieceRecord, RemixBody, RevisionBody, TurnBody } from '@app/api/pieces_schema.pure.lib.ts'
import type { Timers } from '@app/timing/timing_state.pure.lib.ts'

/** The pieces calls a writing game makes. In the app, the pieces adapter's methods. */
export interface PieceWriter {
  readonly create: (piece: PieceBody) => Promise<PieceRecord>
  readonly addRevision: (pieceId: string, revision: RevisionBody) => Promise<void>
  readonly addRemix: (pieceId: string, remix: RemixBody) => Promise<void>
  readonly addTurn: (pieceId: string, turn: TurnBody) => Promise<void>
}

/** What every writing game needs from the world. The bound IllustrationReveal is passed separately (it's a component). */
export interface WritingGameDeps {
  readonly pieces: PieceWriter
  readonly timers: Timers
  /** In [0, 1): `Math.random` in the app. Card draws, genre picks. */
  readonly random: () => number
  /** A fresh session id per game. */
  readonly createId: () => string
}

/** How long the coach "reads" before its questions appear. */
export const COACH_THINKING_MS = 1200
/** The card flip in the draw/deal/twist phases. */
export const CARD_FLIP_MS = 700

/** `pool[floor(random * length)]`, or the first item. */
export function pick<T>(pool: readonly [T, ...T[]], random: () => number): T {
  return pool[Math.floor(random() * pool.length)] ?? pool[0]
}
