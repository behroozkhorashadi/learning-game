interface Props {
  count?: number
  goal?: number
  heading?: string
  caption?: string
}

export function DenJar({ count = 0, goal = 120, heading = 'Story\njar', caption }: Props) {
  const pct = Math.min(100, Math.round((count / goal) * 100))
  const full = pct >= 100
  const resolvedCaption = caption ?? (full ? 'jar is full!' : 'words so far')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 9,
          letterSpacing: '.1em',
          textTransform: 'uppercase',
          fontWeight: 700,
          color: 'var(--fg-paper-label)',
          textAlign: 'center',
          lineHeight: 1.5,
          whiteSpace: 'pre-line',
        }}
      >
        {heading}
      </div>
      <div
        style={{
          position: 'relative',
          width: 60,
          height: 150,
          border: '3px solid var(--sky-100)',
          borderTopWidth: 0,
          borderRadius: '8px 8px 22px 22px',
          background: 'var(--surface-default)',
          overflow: 'hidden',
          flex: 'none',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: `${pct}%`,
            background: 'linear-gradient(180deg,var(--sky-300) 0%,var(--sky-500) 100%)',
            transition: 'height 600ms cubic-bezier(.22,1,.36,1)',
          }}
        />
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 19, color: 'var(--sky-700)', lineHeight: 1 }}>{count}</div>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-paper-faint)', marginTop: 4, lineHeight: 1.4 }}>{resolvedCaption}</div>
      </div>
    </div>
  )
}

export type { Props as DenJarProps }
