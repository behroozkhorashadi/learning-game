import type { PieceBody, PieceRecord, RemixBody, RevisionBody, TurnBody } from '@app/api/pieces_schema.pure.lib.ts'
import { INSTANT_TIMERS } from '@app/timing/manual_timers.test.lib.ts'
import type { Timers } from '@app/timing/timing_state.pure.lib.ts'
import type { PieceWriter, WritingGameDeps } from './writing_game_state.pure.lib.ts'

export interface FakeWriter extends PieceWriter {
  readonly created: readonly PieceBody[]
  readonly revisions: readonly { readonly pieceId: string; readonly revision: RevisionBody }[]
  readonly remixes: readonly RemixBody[]
  readonly turns: readonly TurnBody[]
}

/** An in-memory pieces store that records what each game saves. `failCreate` makes saving reject. */
export function fakeWriter(failCreate: string | null = null): FakeWriter {
  const created: PieceBody[] = []
  const revisions: { pieceId: string; revision: RevisionBody }[] = []
  const remixes: RemixBody[] = []
  const turns: TurnBody[] = []
  return {
    created,
    revisions,
    remixes,
    turns,
    create: (piece) => {
      created.push(piece)
      if (failCreate !== null) return Promise.reject(new Error(failCreate))
      const record: PieceRecord = { id: `piece-${String(created.length)}`, profile_id: piece.profile_id, game_id: piece.game_id, session_id: piece.session_id ?? null, title: piece.title ?? null, body: piece.body, constraints: piece.constraints ?? [], art_style: piece.art_style ?? null, word_count: piece.body.split(/\s+/).length, created_at: '', revised_at: null }
      return Promise.resolve(record)
    },
    addRevision: (pieceId, revision) => {
      revisions.push({ pieceId, revision })
      return Promise.resolve()
    },
    addRemix: (_pieceId, remix) => {
      remixes.push(remix)
      return Promise.resolve()
    },
    addTurn: (_pieceId, turn) => {
      turns.push(turn)
      return Promise.resolve()
    },
  }
}

/** Game deps over a fake writer, a fixed random source, and the given timers (instant by default). */
export function fakeWritingDeps(writer: FakeWriter = fakeWriter(), timers: Timers = INSTANT_TIMERS, random: () => number = () => 0): WritingGameDeps {
  let ids = 0
  return {
    pieces: writer,
    timers,
    random,
    createId: () => {
      ids += 1
      return `session-${String(ids)}`
    },
  }
}
