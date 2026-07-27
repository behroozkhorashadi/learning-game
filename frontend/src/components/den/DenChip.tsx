import type { CSSProperties } from 'react'

export type DenChipTone = 'neutral' | 'green' | 'blue' | 'purple' | 'amber' | 'pink'

interface Props {
  label?: string
  tone?: DenChipTone
  mono?: boolean
  iconPaths?: string[]
}

const TONES: Record<DenChipTone, { color: string; bg: string; border: string }> = {
  neutral: { color: 'var(--paper-1000)', bg: 'var(--surface-paper-wash)', border: 'var(--border-tray)' },
  green: { color: 'var(--mint-800)', bg: 'var(--mint-100)', border: 'var(--mint-300)' },
  blue: { color: 'var(--blue-900)', bg: 'var(--blue-100)', border: 'var(--blue-200)' },
  purple: { color: 'var(--purple-800)', bg: 'var(--purple-100)', border: 'var(--purple-200)' },
  amber: { color: 'var(--fg-warning)', bg: 'var(--orange-200)', border: 'var(--orange-600)' },
  pink: { color: 'var(--pink-800)', bg: 'var(--pink-100)', border: 'var(--pink-200)' },
}

export function DenChip({ label = 'Chip', tone = 'neutral', mono = false, iconPaths = [] }: Props) {
  const t = TONES[tone] || TONES.neutral

  const typeStyle: CSSProperties = mono
    ? { fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '.09em', textTransform: 'uppercase', fontWeight: 700, padding: '5px 8px', borderRadius: 7 }
    : { fontSize: 11.5, fontWeight: 700, padding: '4px 9px', borderRadius: 8 }

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        color: t.color,
        background: t.bg,
        border: `1px solid ${t.border}`,
        ...typeStyle,
      }}
    >
      {iconPaths.length > 0 && (
        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ flex: 'none' }}>
          {iconPaths.map((d, i) => (
            <path key={i} d={d} stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
          ))}
        </svg>
      )}
      {label}
    </div>
  )
}

export type { Props as DenChipProps }
