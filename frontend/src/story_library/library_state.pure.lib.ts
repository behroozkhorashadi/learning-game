import type { IllustrationRecord, PieceRecord } from '@app/api/pieces_schema.pure.lib.ts'
import { isIllustrationStyle, type IllustrationStyle } from '@app/writing/illustration_style.pure.lib.ts'

/**
 * The kid's story library: their saved pieces, newest first, each with its
 * illustrations, plus game titles for the chips. Pure helpers for the shelf
 * and reader views.
 */

export interface LibraryData {
  readonly pieces: readonly PieceRecord[]
  readonly illustrations: Readonly<Record<string, readonly IllustrationRecord[]>>
  readonly gameTitles: Readonly<Record<string, string>>
}

export function newestFirst(pieces: readonly PieceRecord[]): readonly PieceRecord[] {
  const time = (p: PieceRecord): number => (p.created_at === '' ? 0 : new Date(p.created_at).getTime())
  return [...pieces].sort((a, b) => time(b) - time(a))
}

export function styleOf(piece: PieceRecord): IllustrationStyle {
  return isIllustrationStyle(piece.art_style) ? piece.art_style : 'storybook'
}

export function heroOf(illustrations: readonly IllustrationRecord[]): IllustrationRecord | undefined {
  return illustrations.find((i) => i.is_hero) ?? illustrations[0]
}

export function formatDate(iso: string | null): string {
  if (iso === null || iso === '') return ''
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function chunk<T>(items: readonly T[], size: number): readonly (readonly T[])[] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

export type ReaderBlock = { readonly kind: 'text'; readonly text: string } | { readonly kind: 'image'; readonly illustration: IllustrationRecord }

/**
 * The reader's page: each paragraph, with an illustration placed after the
 * paragraph its excerpt came from; illustrations that match none go at the end.
 */
export function buildBlocks(body: string, illustrations: readonly IllustrationRecord[]): readonly ReaderBlock[] {
  const paragraphs = body
    .split(/\n+/)
    .map((p) => p.trim())
    .filter((p) => p !== '')
  const used = new Set<number>()
  const blocks: ReaderBlock[] = []
  for (const text of paragraphs) {
    blocks.push({ kind: 'text', text })
    illustrations.forEach((illustration, i) => {
      if (!used.has(i) && illustration.prompt_excerpt !== '' && text.includes(illustration.prompt_excerpt)) {
        blocks.push({ kind: 'image', illustration })
        used.add(i)
      }
    })
  }
  illustrations.forEach((illustration, i) => {
    if (!used.has(i)) blocks.push({ kind: 'image', illustration })
  })
  return blocks
}

export function byOrder(illustrations: readonly IllustrationRecord[]): readonly IllustrationRecord[] {
  return [...illustrations].sort((a, b) => a.order - b.order)
}
