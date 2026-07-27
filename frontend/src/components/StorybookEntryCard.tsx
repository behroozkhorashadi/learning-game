import { useEffect, useState, type CSSProperties } from 'react'
import { ArrowRightIcon } from './icons'
import { Cover } from './Storybook'
import type { Illustration, Piece } from '../types/generated'

/**
 * The kid-home entry point for the storybook — "4b" in `Storybook.dc.html`.
 * Sits beside the game tiles on `GamePicker.tsx`, not in a nav.
 */

const PLUS_ICON = ['M12 5.75V18.25M5.75 12H18.25']

const PEEK_STYLES: CSSProperties[] = [
  { transform: 'rotate(-9deg) translate(-30px, 6px)', zIndex: 1 },
  { transform: 'rotate(4deg) translate(14px, 2px)', zIndex: 2 },
  { transform: 'rotate(-2deg) translate(-8px, -10px)', zIndex: 3 },
]

interface Props {
  profileId: number
  onOpen: () => void
}

export function StorybookEntryCard({ profileId, onOpen }: Props) {
  const [pieces, setPieces] = useState<Piece[] | null>(null)
  const [illustrationsByPiece, setIllustrationsByPiece] = useState<Record<string, Illustration[]>>({})

  useEffect(() => {
    fetch(`/api/pieces?profile_id=${profileId}`)
      .then((r) => {
        if (!r.ok) throw new Error(`GET /api/pieces -> ${r.status}`)
        return r.json() as Promise<Piece[]>
      })
      .then((pieceList) => {
        const sorted = [...pieceList].sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime())
        setPieces(sorted)
        return Promise.all(
          sorted.slice(0, 3).map((p) =>
            fetch(`/api/pieces/${p.id}/illustrations`)
              .then((r) => (r.ok ? (r.json() as Promise<Illustration[]>) : []))
              .then((ills) => [p.id!, ills] as const),
          ),
        )
      })
      .then((entries) => setIllustrationsByPiece(Object.fromEntries(entries)))
      .catch(() => setPieces([]))
  }, [profileId])

  if (pieces === null) return null

  const hasPieces = pieces.length > 0
  const peek = pieces.slice(0, 3).reverse()
  const newest = pieces[0]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '.09em', textTransform: 'uppercase', fontWeight: 700, color: '#A99F8B' }}>
        {hasPieces ? 'Has stories' : 'Nothing in it yet'}
      </div>
      <button
        type="button"
        onClick={onOpen}
        style={{ display: 'flex', alignItems: 'center', gap: 18, background: '#FFFDF8', border: '1.5px solid #EDE5D5', borderRadius: 22, padding: '18px 20px', cursor: 'pointer', textAlign: 'left', boxShadow: '0 16px 32px -18px rgba(0,13,51,.20)' }}
      >
        <div style={{ position: 'relative', width: 86, height: 86, flex: 'none' }}>
          {hasPieces ? (
            peek.map((p, i) => (
              <div
                key={p.id}
                style={{
                  position: 'absolute',
                  inset: 0,
                  margin: 'auto',
                  width: 62,
                  height: 78,
                  borderRadius: 10,
                  overflow: 'hidden',
                  border: '1.5px solid #EDE5D5',
                  background: '#F6F1E6',
                  boxShadow: '0 8px 16px -8px rgba(0,13,51,.30)',
                  ...PEEK_STYLES[i],
                }}
              >
                <Cover piece={p} illustrations={illustrationsByPiece[p.id!] ?? []} label="" showLabel={false} />
              </div>
            ))
          ) : (
            <div
              style={{
                width: '100%',
                height: '100%',
                borderRadius: 16,
                border: '1.5px dashed #E0D3B8',
                background: '#FBF6EC',
                color: '#C4B79E',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg width={26} height={26} viewBox="0 0 24 24" fill="none" aria-hidden="true">
                {PLUS_ICON.map((d, i) => (
                  <path key={i} d={d} stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                ))}
              </svg>
            </div>
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18, color: '#2A2E37' }}>My storybook</div>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: '#9A907C', marginTop: 3 }}>
            {hasPieces ? `${pieces.length} ${pieces.length === 1 ? 'story' : 'stories'}` : "Empty for now — write something and it'll land here."}
          </div>
          {hasPieces && newest?.title && (
            <div
              style={{
                display: 'inline-block',
                marginTop: 9,
                fontFamily: 'var(--font-mono)',
                fontSize: 9.5,
                fontWeight: 700,
                letterSpacing: '.05em',
                color: '#2C6416',
                background: '#DBF5D1',
                border: '1px solid #A1E486',
                borderRadius: 7,
                padding: '3px 8px',
              }}
            >
              New: {newest.title}
            </div>
          )}
        </div>

        <div style={{ color: '#8A8272', flex: 'none' }}>
          <ArrowRightIcon size={22} />
        </div>
      </button>
    </div>
  )
}
