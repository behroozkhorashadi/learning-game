import type { CSSProperties } from 'react'

export type DenTileTheme = 'purple' | 'blue' | 'green' | 'amber' | 'pink'
export type DenTileSize = 'sm' | 'md' | 'phrase'

interface Props {
  label?: string
  theme?: DenTileTheme
  size?: DenTileSize
  selected?: boolean
  flipping?: boolean
  onClick?: () => void
}

const THEMES: Record<DenTileTheme, { fill: string; text: string; lip: string }> = {
  purple: { fill: '#EBDCFE', text: '#5006B2', lip: '#CBA6FC' },
  blue: { fill: '#DBE4FF', text: '#00289E', lip: '#A3BAFF' },
  green: { fill: '#DBF5D1', text: '#2C6416', lip: '#A1E486' },
  amber: { fill: '#FDECCE', text: '#7F5305', lip: '#F7B23B' },
  pink: { fill: '#F9DDEF', text: '#741553', lip: '#EFA9D7' },
}

const SIZES: Record<DenTileSize, CSSProperties> = {
  sm: { minWidth: 78, height: 64, padding: '0 13px', fontSize: 20, borderRadius: 14 },
  md: { minWidth: 92, height: 88, padding: '0 18px', fontSize: 34, borderRadius: 18 },
  phrase: { minWidth: 112, height: 88, padding: '0 16px', fontSize: 16, borderRadius: 18 },
}

export function DenTile({ label = '', theme = 'purple', size = 'md', selected = false, flipping = false, onClick }: Props) {
  const t = THEMES[theme] || THEMES.purple

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: 'transparent',
        border: 0,
        padding: 0,
        cursor: 'pointer',
        perspective: 900,
        transformStyle: 'preserve-3d',
        transition: 'transform 140ms cubic-bezier(.2,0,0,1)',
        ...(flipping ? { transform: 'rotateY(90deg)', transition: 'transform 250ms cubic-bezier(.5,0,1,.6)' } : {}),
      }}
    >
      <div
        style={{
          boxSizing: 'border-box',
          border: 'none',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          fontFamily: 'var(--font-display)',
          fontWeight: 800,
          lineHeight: 1.2,
          userSelect: 'none',
          touchAction: 'none',
          ...SIZES[size],
          background: t.fill,
          color: t.text,
          boxShadow: `0 6px 0 ${t.lip}`,
          ...(selected ? { outline: `3px solid ${t.text}`, outlineOffset: 3 } : {}),
        }}
      >
        {label}
      </div>
    </button>
  )
}

export type { Props as DenTileProps }
