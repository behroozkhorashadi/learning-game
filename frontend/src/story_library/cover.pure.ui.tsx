import { useState, type ReactElement } from 'react'
import type { IllustrationRecord, PieceRecord } from '@app/api/pieces_schema.pure.lib.ts'
import { swatchOf } from '@app/writing/illustration_style.pure.lib.ts'
import { heroOf, styleOf } from './library_state.pure.lib.ts'

export interface CoverProps {
  readonly piece: PieceRecord
  readonly illustrations: readonly IllustrationRecord[]
  readonly label: string
  readonly showLabel?: boolean
}

/** A piece's hero picture, or its style's swatch when it has none (or the image fails). */
export function Cover({ piece, illustrations, label, showLabel = true }: CoverProps): ReactElement {
  const [broken, setBroken] = useState(false)
  const hero = heroOf(illustrations)
  if (hero === undefined || hero.image_url === '' || broken) {
    return (
      <div style={{ width: '100%', height: '100%', background: swatchOf(styleOf(piece)), display: 'flex', alignItems: 'flex-end' }}>
        {showLabel && (
          <div style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.9)', textShadow: '0 1px 3px rgba(0,0,0,.35)' }}>{label}</div>
        )}
      </div>
    )
  }
  return (
    <img
      src={hero.image_url}
      alt=""
      onError={() => {
        setBroken(true)
      }}
      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
    />
  )
}
