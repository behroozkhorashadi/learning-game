interface Props {
  flipped?: boolean
  backLabel?: string
  kicker?: string
  cardName?: string
  meaning?: string
  example?: string
  exampleLabel?: string
  accent?: string
  tint?: string
  tier?: 0 | 1 | 2 | 3
  width?: number
  height?: number
  iconPaths?: string[]
}

export function DenFlipCard({
  flipped = true,
  backLabel = 'Card',
  kicker = '',
  cardName = '',
  meaning = '',
  example = '',
  exampleLabel = 'Sounds like',
  accent = '#144FFF',
  tint = '#EDF2FF',
  tier = 0,
  width = 236,
  height = 320,
  iconPaths = [],
}: Props) {
  const pips = tier ? [1, 2, 3].map((i) => i <= tier) : []

  return (
    <div style={{ position: 'relative', width, height, perspective: 1400 }}>
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          transformStyle: 'preserve-3d',
          transform: `rotateY(${flipped ? 0 : 180}deg)`,
          transition: 'transform 660ms cubic-bezier(.34,1.16,.44,1)',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
            borderRadius: 22,
            background: 'var(--navy-800)',
            border: '2px solid var(--navy-900)',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 18px 34px -14px rgba(0,13,51,.42)',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: 'repeating-linear-gradient(135deg,rgba(255,255,255,.055) 0 9px,transparent 9px 18px)',
            }}
          />
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 6, background: accent }} />
          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 13, color: 'rgba(255,255,255,.72)' }}>
            <div
              style={{
                width: 66,
                height: 66,
                borderRadius: 20,
                border: '2px solid rgba(255,255,255,.22)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg width={30} height={30} viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M17 4.75C17 5.89705 15.8971 7 14.75 7C15.8971 7 17 8.10295 17 9.25C17 8.10295 18.1029 7 19.25 7C18.1029 7 17 5.89705 17 4.75Z"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M17 14.75C17 15.8971 15.8971 17 14.75 17C15.8971 17 17 18.1029 17 19.25C17 18.1029 18.1029 17 19.25 17C18.1029 17 17 15.8971 17 14.75Z"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M9 7.75C9 9.91666 6.91666 12 4.75 12C6.91666 12 9 14.0833 9 16.25C9 14.0833 11.0833 12 13.25 12C11.0833 12 9 9.91666 9 7.75Z"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.16em', textTransform: 'uppercase', fontWeight: 700, color: 'rgba(255,255,255,.5)' }}>
              {backLabel}
            </div>
          </div>
        </div>

        <div
          style={{
            position: 'absolute',
            inset: 0,
            backfaceVisibility: 'hidden',
            borderRadius: 22,
            background: 'var(--surface-paper)',
            border: '2px solid var(--border-paper)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 38px -16px rgba(0,13,51,.28)',
          }}
        >
          <div style={{ height: 6, background: accent, flex: 'none' }} />
          <div style={{ flex: 1, padding: '22px 20px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '.11em', textTransform: 'uppercase', fontWeight: 700, color: accent }}>{kicker}</div>
              <div style={{ display: 'flex', gap: 3 }}>
                {pips.map((on, i) => (
                  <div key={i} style={{ width: 5, height: 5, borderRadius: 9999, background: on ? accent : 'var(--paper-400)' }} />
                ))}
              </div>
            </div>
            <div
              style={{
                width: 58,
                height: 58,
                borderRadius: 18,
                background: tint,
                color: accent,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '20px 0 16px',
                flex: 'none',
              }}
            >
              <svg width={30} height={30} viewBox="0 0 24 24" fill="none" aria-hidden="true">
                {iconPaths.map((d, i) => (
                  <path key={i} d={d} stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                ))}
              </svg>
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 23, lineHeight: 1.1, color: 'var(--fg-paper-heading)', letterSpacing: '-.005em' }}>
              {cardName}
            </div>
            {meaning && (
              <div style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--fg-paper-secondary)', marginTop: 9 }}>{meaning}</div>
            )}
            {example && (
              <div style={{ marginTop: 'auto', paddingTop: 15, borderTop: '1px dashed var(--paper-300)' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.1em', textTransform: 'uppercase', fontWeight: 700, color: 'var(--paper-700)', marginBottom: 5 }}>
                  {exampleLabel}
                </div>
                <div style={{ fontSize: 13.5, lineHeight: 1.45, color: 'var(--paper-1100)', fontStyle: 'italic' }}>{example}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export type { Props as DenFlipCardProps }
