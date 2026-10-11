import type { GameRecord, IllustrationRecord, PieceRecord } from '@app/api/pieces_schema.pure.lib.ts'
import type { LibrarySource } from './library_loader.pure.lib.ts'
import type { LibraryData } from './library_state.pure.lib.ts'

/** Shared fixtures and an in-memory pieces store for the story library's tests and stories. */

export const GAMES: readonly GameRecord[] = [{ id: 'syllable_builder', title: 'Syllable Builder', tagline: '', skill_ids: [], min_age: 5, max_age: 8, icon: '🧩', max_level: 10 }]

export function piece(id: string, overrides: Partial<PieceRecord> = {}): PieceRecord {
  return {
    id,
    profile_id: 1,
    game_id: 'syllable_builder',
    session_id: null,
    title: 'The Ninety-Six Steps',
    body: 'The lighthouse had been dark for eleven years.',
    constraints: ['a lighthouse'],
    art_style: 'storybook',
    word_count: 8,
    created_at: '2026-01-01T00:00:00Z',
    revised_at: null,
    ...overrides,
  }
}

export function illustration(pieceId: string, overrides: Partial<IllustrationRecord> = {}): IllustrationRecord {
  return { id: null, piece_id: pieceId, image_url: '', prompt_excerpt: '', order: 0, is_hero: true, created_at: '', ...overrides }
}

export const LIGHTHOUSE = piece('p1')
export const CROW = piece('p2', { title: 'The Crow', body: 'A crow found a map.\nIt flew home.', created_at: '2026-02-01T00:00:00Z', constraints: [] })

export function library(pieces: readonly PieceRecord[]): LibraryData {
  return { pieces, illustrations: {}, gameTitles: { syllable_builder: 'Syllable Builder' } }
}

export interface FakePiecesStore extends LibrarySource {
  readonly remove: (pieceId: string) => Promise<void>
  readonly removed: readonly string[]
}

/** An in-memory pieces store: lists what's left, records removals, and can fail a whole call. */
export function fakePiecesStore(
  pieces: readonly PieceRecord[],
  illustrations: Readonly<Record<string, readonly IllustrationRecord[]>> = {},
  fail: { readonly list?: string; readonly remove?: string; readonly illustrations?: string } = {},
): FakePiecesStore {
  let current = pieces
  const removed: string[] = []
  return {
    removed,
    list: () => (fail.list === undefined ? Promise.resolve(current) : Promise.reject(new Error(fail.list))),
    games: () => Promise.resolve(GAMES),
    illustrations: (id) => (fail.illustrations === undefined ? Promise.resolve(illustrations[id] ?? []) : Promise.reject(new Error(fail.illustrations))),
    remove: (id) => {
      if (fail.remove !== undefined) return Promise.reject(new Error(fail.remove))
      removed.push(id)
      current = current.filter((p) => p.id !== id)
      return Promise.resolve()
    },
  }
}
