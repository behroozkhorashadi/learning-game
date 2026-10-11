import { useState, type CSSProperties, type ReactElement } from 'react'
import { ImagePlaceholderIcon } from '@app/den/icons.pure.ui.tsx'

const BOX: CSSProperties = {
  flex: 'none',
  width: 132,
  height: 132,
  borderRadius: 22,
  background: 'var(--surface-subtle)',
  border: '2px dashed var(--border-tray)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  color: 'var(--fg-disabled)',
  boxSizing: 'border-box',
  padding: 8,
  overflow: 'hidden',
}

/** The word's picture (`make gen-images`), or a placeholder until it has one. Key it by word. */
export function WordPicture({ word }: { readonly word: string }): ReactElement {
  const [broken, setBroken] = useState(false)
  if (broken) {
    return (
      <div style={BOX}>
        <ImagePlaceholderIcon size={32} />
        <span style={{ fontSize: 12, fontWeight: 600, textAlign: 'center', lineHeight: 1.3 }}>No picture yet</span>
      </div>
    )
  }
  return (
    <div style={BOX}>
      <img
        src={`/images/words/${word}.png`}
        alt={word}
        onError={() => {
          setBroken(true)
        }}
        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
      />
    </div>
  )
}
