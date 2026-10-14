import type { CSSProperties, ReactElement } from 'react'
import type { BadgeRecord } from '@app/api/badges_schema.pure.lib.ts'
import { DenButton } from '@app/den/den_button.pure.ui.tsx'
import { BadgeMedal } from './badge_medal.pure.ui.tsx'
import { TIER_STYLES } from './badges_format.pure.lib.ts'

/**
 * The fanfare for a new badge. `BadgeCelebration` takes over the screen: spinning
 * rays, falling confetti, and the medal spinning in, with why it was earned and
 * its personal art arriving as it's painted. `BadgeToast` is the quiet version
 * shown over a game in progress, which never takes a click or the focus.
 */

const CONFETTI_COLORS = ['#FF5C8A', '#FFC93C', '#5BCC2D', '#3FC5FF', '#A66CFF', '#FF8A3D'] as const
const CONFETTI_PIECES = 42

/** A confetti piece's own fall, read by the `badge-confetti` keyframes. */
type ConfettiStyle = CSSProperties & { readonly '--delay': string; readonly '--fall': string; readonly '--drift': string; readonly '--spin': string }

function Confetti(): ReactElement {
  return (
    <div aria-hidden="true" style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {Array.from({ length: CONFETTI_PIECES }, (_, i) => {
        // Spread by index, not at random, so every celebration (and test) looks the same.
        const style: ConfettiStyle = {
          position: 'absolute',
          top: 0,
          left: `${String((i * 37) % 100)}%`,
          width: 8 + (i % 3) * 3,
          height: 12 + (i % 4) * 2,
          borderRadius: i % 5 === 0 ? 9999 : 2,
          background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
          '--delay': `${((i * 0.13) % 2.6).toFixed(2)}s`,
          '--fall': `${(2.6 + (i % 5) * 0.4).toFixed(1)}s`,
          '--drift': `${String(((i % 7) - 3) * 28)}px`,
          '--spin': `${String(360 + (i % 4) * 180)}deg`,
        }
        return <span key={i} className="badge-confetti" style={style} />
      })}
    </div>
  )
}

export interface BadgeCelebrationProps {
  readonly badge: BadgeRecord
  /** How many more new badges are waiting after this one. */
  readonly remaining: number
  readonly animate: boolean
  readonly onDone: () => void
}

export function BadgeCelebration({ badge, remaining, animate, onDone }: BadgeCelebrationProps): ReactElement {
  const tier = TIER_STYLES[badge.tier]
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="New badge!"
      style={{ position: 'fixed', inset: 0, zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, overflow: 'hidden', background: 'radial-gradient(circle at 50% 40%, #2B3A8C 0%, #141A3F 70%)' }}
    >
      <div
        aria-hidden="true"
        className="badge-celebrate-rays"
        style={{ position: 'absolute', width: '160vmax', height: '160vmax', left: '50%', top: '40%', marginLeft: '-80vmax', marginTop: '-80vmax', background: `repeating-conic-gradient(from 0deg, ${tier.rim[1]}33 0deg 9deg, transparent 9deg 22deg)` }}
      />
      {animate && <Confetti />}
      <div style={{ position: 'relative', textAlign: 'center', maxWidth: 440, color: '#FFFFFF' }}>
        <div className="badge-rise-in" style={{ fontFamily: 'var(--font-mono)', fontSize: 14, letterSpacing: '0.2em', fontWeight: 800, color: '#FFD84D', textTransform: 'uppercase' }}>
          New badge!
        </div>
        <div className="badge-celebrate-pop" style={{ display: 'flex', justifyContent: 'center', margin: '14px 0 8px' }}>
          <BadgeMedal badge={badge} size={220} animate={animate} />
        </div>
        <h2 className="badge-rise-in" style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 40, lineHeight: 1.05, margin: 0, textShadow: '0 3px 0 rgba(0,0,0,0.25)' }}>
          {badge.name}
        </h2>
        <div style={{ display: 'inline-block', marginTop: 8, padding: '4px 12px', borderRadius: 9999, background: tier.rim[1], color: badge.tier === 'silver' ? '#2A2E37' : '#FFFFFF', fontSize: 12, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          {tier.label}
        </div>
        <p style={{ fontSize: 19, fontWeight: 700, margin: '14px 0 0', lineHeight: 1.35 }}>{badge.earned_reason ?? badge.description}</p>
        {badge.art_status === 'pending' && (
          <p role="status" className="badge-art-shimmer" style={{ fontSize: 14, color: '#C9D3FF', margin: '10px 0 0' }}>
            ✨ Painting your one-of-a-kind badge art…
          </p>
        )}
        {badge.art_status === 'ready' && <p style={{ fontSize: 14, color: '#C9D3FF', margin: '10px 0 0' }}>✨ Painted just for you!</p>}
        <div style={{ marginTop: 22, display: 'flex', justifyContent: 'center' }}>
          <DenButton label={remaining > 0 ? `Next badge (${String(remaining)} more)` : 'Awesome!'} variant="primary" shape="pill" size="lg" onClick={onDone} />
        </div>
      </div>
    </div>
  )
}

export function BadgeToast({ badge }: { readonly badge: BadgeRecord }): ReactElement {
  return (
    <div
      role="status"
      className="badge-toast"
      style={{ position: 'fixed', top: 14, left: '50%', zIndex: 500, pointerEvents: 'none', display: 'flex', alignItems: 'center', gap: 12, padding: '8px 18px 8px 8px', borderRadius: 9999, background: '#141A3F', color: '#FFFFFF', boxShadow: '0 12px 30px -8px rgba(0,0,0,0.5)', border: `2px solid ${TIER_STYLES[badge.tier].rim[1]}` }}
    >
      <BadgeMedal badge={badge} size={48} />
      <div style={{ textAlign: 'left' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.14em', fontWeight: 800, color: '#FFD84D', textTransform: 'uppercase' }}>New badge!</div>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18 }}>{badge.name}</div>
      </div>
    </div>
  )
}
