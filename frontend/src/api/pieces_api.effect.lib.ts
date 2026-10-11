import type { z } from 'zod'
import type { HttpFetch } from './http.pure.lib.ts'
import {
  gameListSchema,
  illustrationListSchema,
  illustrationSchema,
  pieceListSchema,
  pieceSchema,
  type GameRecord,
  type IllustrationRecord,
  type IllustrationRequest,
  type PieceBody,
  type PieceRecord,
  type RemixBody,
  type RevisionBody,
  type TurnBody,
} from './pieces_schema.pure.lib.ts'

/** Adapter for saved writing (pieces), their revision/remix/turn records, illustrations, and the game catalog. */
export interface PiecesApi {
  readonly list: (profileId: number) => Promise<readonly PieceRecord[]>
  readonly create: (piece: PieceBody) => Promise<PieceRecord>
  readonly remove: (pieceId: string) => Promise<void>
  readonly addRevision: (pieceId: string, revision: RevisionBody) => Promise<void>
  readonly addRemix: (pieceId: string, remix: RemixBody) => Promise<void>
  readonly addTurn: (pieceId: string, turn: TurnBody) => Promise<void>
  readonly illustrations: (pieceId: string) => Promise<readonly IllustrationRecord[]>
  readonly generateIllustration: (pieceId: string, request: IllustrationRequest) => Promise<IllustrationRecord>
  readonly games: () => Promise<readonly GameRecord[]>
}

const JSON_HEADERS = { Accept: 'application/json', 'Content-Type': 'application/json' }

export function bindPiecesApi({ fetch, baseUrl }: { readonly fetch: HttpFetch; readonly baseUrl: string }): PiecesApi {
  async function call(method: 'GET' | 'POST' | 'DELETE', path: string, body?: unknown): Promise<unknown> {
    const response = await fetch(`${baseUrl}${path}`, body === undefined ? { method, headers: { Accept: 'application/json' } } : { method, headers: JSON_HEADERS, body: JSON.stringify(body) })
    if (!response.ok) throw new Error(`${method} ${path} failed with HTTP ${String(response.status)}`)
    return method === 'DELETE' ? null : response.json()
  }
  async function parsed<T>(schema: z.ZodType<T>, method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
    const result = schema.safeParse(await call(method, path, body))
    if (!result.success) throw new Error(`${method} ${path} returned an unexpected body: ${result.error.message}`)
    return result.data
  }
  const piecePath = (id: string): string => `/api/pieces/${encodeURIComponent(id)}`
  return {
    list: (profileId) => parsed(pieceListSchema, 'GET', `/api/pieces?profile_id=${String(profileId)}`),
    create: (piece) => parsed(pieceSchema, 'POST', '/api/pieces', piece),
    remove: async (id) => {
      await call('DELETE', piecePath(id))
    },
    addRevision: async (id, revision) => {
      await call('POST', `${piecePath(id)}/revisions`, revision)
    },
    addRemix: async (id, remix) => {
      await call('POST', `${piecePath(id)}/remixes`, remix)
    },
    addTurn: async (id, turn) => {
      await call('POST', `${piecePath(id)}/turns`, turn)
    },
    illustrations: (id) => parsed(illustrationListSchema, 'GET', `${piecePath(id)}/illustrations`),
    generateIllustration: (id, request) => parsed(illustrationSchema, 'POST', `${piecePath(id)}/illustrations/generate`, request),
    games: () => parsed(gameListSchema, 'GET', '/api/games'),
  }
}
