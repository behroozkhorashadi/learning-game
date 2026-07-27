import { useState } from 'react'
import { DenButton } from './den/DenButton'

/**
 * Star-rating prompt — ported from the Claude Design handoff bundle
 * (`Rating & Summary.dc.html`, "STAR RATING PROMPT" section). Shown once a
 * session completes, above the `SessionComplete` reward card. Sampling
 * behavior (asking roughly one session in N, per the `Rating` model's own
 * docstring) is out of scope here — this always shows and is always easy to
 * skip, matching the design's "occasional, easy to skip" framing without
 * implementing the sampling itself.
 */

const CAPTIONS = ['', 'Thanks for telling us', 'Thanks for telling us', 'Glad you liked it', 'Glad you liked it', 'Yay — thank you!']

interface Props {
  onRate: (value: number) => void
  onDismiss: () => void
}

function StarIcon({ size = 46, fill, stroke }: { size?: number; fill: string; stroke: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M12 3.5L14.7 9.3L21 10L16.3 14.3L17.6 20.5L12 17.3L6.4 20.5L7.7 14.3L3 10L9.3 9.3L12 3.5Z"
        fill={fill}
        stroke={stroke}
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function RatingPrompt({ onRate, onDismiss }: Props) {
  const [rating, setRating] = useState(0)
  const [hover, setHover] = useState(0)
  const active = hover || rating

  return (
    <div
      style={{
        position: 'relative',
        background: '#FFF6EA',
        border: '1px solid #F1ECE0',
        borderRadius: 28,
        padding: '30px 32px',
        boxShadow: '0 22px 44px -16px rgba(0,13,51,0.14)',
        boxSizing: 'border-box',
      }}
    >
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Close"
        title="Not now"
        style={{
          position: 'absolute',
          top: 18,
          right: 18,
          width: 40,
          height: 40,
          borderRadius: 9999,
          border: 'none',
          background: '#FBF8F2',
          color: '#8896AA',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path d="M8 8L16 16M16 8L8 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 9999,
            background: '#FDECCE',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flex: 'none',
          }}
        >
          <StarIcon size={36} fill="#F7B23B" stroke="#E0940C" />
        </div>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 24, lineHeight: 1.15, color: '#2A2E37' }}>
            How was that game?
          </div>
          <div style={{ marginTop: 4, fontSize: 16, color: '#8896AA' }}>Tap a star — or skip, that's fine too.</div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 12, margin: '24px 0 6px' }}>
        {[1, 2, 3, 4, 5].map((n) => {
          const on = n <= active
          return (
            <button
              key={n}
              type="button"
              onPointerEnter={() => setHover(n)}
              onPointerLeave={() => setHover(0)}
              onClick={() => {
                setRating(n)
                onRate(n)
              }}
              aria-label={`${n} star${n > 1 ? 's' : ''}`}
              style={{ background: 'none', border: 'none', padding: 2, cursor: 'pointer', lineHeight: 0 }}
            >
              <StarIcon fill={on ? '#F7B23B' : '#F0EBDE'} stroke={on ? '#E0940C' : '#E0D8C6'} />
            </button>
          )
        })}
      </div>

      <div style={{ textAlign: 'center', height: 24, fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 17, color: '#7F5305' }}>
        {rating ? CAPTIONS[rating] : ''}
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 12 }}>
        <DenButton label="Not now" variant="ghost" size="sm" onClick={onDismiss} />
      </div>
    </div>
  )
}
