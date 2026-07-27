import type { CSSProperties, ReactNode } from 'react'

export type DenCardTone = 'paper' | 'warm' | 'sunken' | 'plain'
export type DenCardShadow = 'none' | 'soft' | 'card' | 'deep'

interface Props {
  kicker?: string
  title?: string
  meta?: string
  footerNote?: string
  tone?: DenCardTone
  shadow?: DenCardShadow
  radius?: number
  bodyPadding?: number
  children?: ReactNode
  footerSlot?: ReactNode
}

const TONES: Record<DenCardTone, CSSProperties> = {
  paper: { background: 'var(--surface-paper)', border: '1px solid var(--border-paper)' },
  warm: { background: 'var(--surface-app)', border: '1px solid var(--border-subtle)' },
  sunken: { background: 'var(--surface-paper-sunken)', border: '1px solid var(--border-paper-sunken)' },
  plain: { background: 'var(--surface-default)', border: '1px solid var(--border-subtle)' },
}

const SHADOWS: Record<DenCardShadow, string> = {
  none: '',
  soft: '0 14px 30px -18px rgba(0,13,51,.14)',
  card: '0 22px 44px -16px rgba(0,13,51,.14),0 2px 0 rgba(0,13,51,.03)',
  deep: '0 24px 48px -20px rgba(0,13,51,.16)',
}

export function DenCard({ kicker = '', title = '', meta = '', footerNote = '', tone = 'paper', shadow = 'deep', radius = 28, bodyPadding = 26, children, footerSlot }: Props) {
  const hasHeader = !!(kicker || title)
  const hasFooter = !!(footerNote || footerSlot)

  return (
    <div
      style={{
        boxSizing: 'border-box',
        overflow: 'hidden',
        borderRadius: radius,
        ...(TONES[tone] || TONES.paper),
        ...(SHADOWS[shadow] ? { boxShadow: SHADOWS[shadow] } : {}),
      }}
    >
      {hasHeader && (
        <div
          style={{
            borderBottom: '1px solid var(--border-paper-divider)',
            background: 'var(--surface-paper-wash)',
            padding: '15px 26px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ minWidth: 0 }}>
            {kicker && (
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', fontWeight: 700, color: 'var(--fg-paper-label)' }}>
                {kicker}
              </div>
            )}
            {title && (
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 19, lineHeight: 1.15, color: 'var(--fg-paper-heading)', marginTop: 2 }}>{title}</div>
            )}
          </div>
          {meta && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: 'var(--fg-paper-faint)', flex: 'none' }}>{meta}</div>}
        </div>
      )}

      <div style={{ padding: bodyPadding }}>{children}</div>

      {hasFooter && (
        <div
          style={{
            borderTop: '1px solid var(--border-paper-divider)',
            background: 'var(--surface-paper-wash)',
            padding: '15px 26px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 14,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-paper-faint)', textWrap: 'pretty' as CSSProperties['textWrap'] }}>{footerNote}</div>
          {footerSlot && <div style={{ flex: 'none' }}>{footerSlot}</div>}
        </div>
      )}
    </div>
  )
}

export type { Props as DenCardProps }
