import { useState, type ReactElement } from 'react'
import { swatchOf, type IllustrationStyle } from './illustration_style.pure.lib.ts'

/** The style's swatch with a small label: what a picture looks like before (or instead of) the real image. */
export function ArtPlaceholder({ style, label }: { readonly style: IllustrationStyle; readonly label: string }): ReactElement {
  return (
    <div role="img" aria-label={label} style={{ position: 'relative', width: '100%', height: '100%', background: swatchOf(style), display: 'flex', alignItems: 'flex-end' }}>
      <div style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.9)', textShadow: '0 1px 3px rgba(0,0,0,.35)' }}>{label}</div>
    </div>
  )
}

/** A generated illustration, falling back to the placeholder when there's no image or it fails to load. */
export function IllustrationArt({ imageUrl, style, label }: { readonly imageUrl: string; readonly style: IllustrationStyle; readonly label: string }): ReactElement {
  const [broken, setBroken] = useState(false)
  if (imageUrl === '' || broken) return <ArtPlaceholder style={style} label={label} />
  return (
    <img
      src={imageUrl}
      alt={label}
      onError={() => {
        setBroken(true)
      }}
      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
    />
  )
}
