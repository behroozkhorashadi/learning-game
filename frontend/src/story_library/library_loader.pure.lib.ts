import type { GameRecord, IllustrationRecord, PieceRecord } from '@app/api/pieces_schema.pure.lib.ts'
import { newestFirst, type LibraryData } from './library_state.pure.lib.ts'

/** The slice of the pieces adapter the library reads. */
export interface LibrarySource {
  readonly list: (profileId: number) => Promise<readonly PieceRecord[]>
  readonly games: () => Promise<readonly GameRecord[]>
  readonly illustrations: (pieceId: string) => Promise<readonly IllustrationRecord[]>
}

/** Illustrations for each piece; a piece whose illustrations fail to load just has none. */
async function illustrationsFor(
  illustrations: LibrarySource['illustrations'],
  pieces: readonly PieceRecord[],
): Promise<Readonly<Record<string, readonly IllustrationRecord[]>>> {
  const entries = await Promise.all(pieces.map(async (p) => [p.id, await illustrations(p.id).catch((): readonly IllustrationRecord[] => [])] as const))
  return Object.fromEntries(entries)
}

/** Everything the library screen shows, in one load. Fails if the piece list or the game catalog does. */
export async function loadLibrary(source: LibrarySource, profileId: number): Promise<LibraryData> {
  const [pieces, games] = await Promise.all([source.list(profileId), source.games()])
  const sorted = newestFirst(pieces)
  return { pieces: sorted, illustrations: await illustrationsFor(source.illustrations, sorted), gameTitles: Object.fromEntries(games.map((g) => [g.id, g.title])) }
}

/** How many covers the home card fans out. */
export const PEEK_COUNT = 3

export interface ShelfPeek {
  readonly pieces: readonly PieceRecord[]
  /** Only for the newest PEEK_COUNT pieces. */
  readonly illustrations: Readonly<Record<string, readonly IllustrationRecord[]>>
}

/** What the home entry card shows. Never fails: a load error reads as an empty library. */
export async function loadShelfPeek(source: Pick<LibrarySource, 'list' | 'illustrations'>, profileId: number): Promise<ShelfPeek> {
  try {
    const pieces = newestFirst(await source.list(profileId))
    return { pieces, illustrations: await illustrationsFor(source.illustrations, pieces.slice(0, PEEK_COUNT)) }
  } catch {
    return { pieces: [], illustrations: {} }
  }
}
