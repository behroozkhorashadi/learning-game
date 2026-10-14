import type { ReactElement, ReactNode } from 'react'
import type { BadgeRecord } from '@app/api/badges_schema.pure.lib.ts'
import { DenButton } from '@app/den/den_button.pure.ui.tsx'
import { BadgeMedal } from './badge_medal.pure.ui.tsx'
import { CATEGORY_STYLES, TIER_STYLES, bestSoFarText, earnedWhenText, progressFraction, progressText, toGoText } from './badges_format.pure.lib.ts'

/** Where painting this badge's art stands, from the screen's point of view. */
export type PaintState = 'idle' | 'painting' | 'failed'

export interface BadgeDetailProps {
  readonly badge: BadgeRecord
  readonly paint: PaintState
  readonly onPaint: () => void
  readonly onClose: () => void
  readonly animate: boolean
}

/** A centered card over a dimmed screen; Escape or the close button dismisses it. */
export function Dialog({ label, onClose, children }: { readonly label: string; readonly onClose: () => void; readonly children: ReactNode }): ReactElement {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(20,24,40,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, overflowY: 'auto' }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        onKeyDown={(event) => {
          if (event.key === 'Escape') onClose()
        }}
        className="badge-rise-in"
        style={{ position: 'relative', width: '100%', maxWidth: 480, maxHeight: '100%', overflowY: 'auto', background: '#FFFDF8', borderRadius: 32, padding: '28px 24px 24px', boxShadow: '0 30px 60px -20px rgba(0,13,51,0.45)', boxSizing: 'border-box' }}
      >
        <button
          type="button"
          aria-label="Close"
          title="Close"
          // The dialog takes focus as it opens, so Escape and Tab start inside it.
          autoFocus
          onClick={onClose}
          style={{ position: 'absolute', top: 14, right: 14, width: 44, height: 44, borderRadius: 9999, border: '2px solid #E7E2D6', background: '#FFFFFF', color: '#515E71', fontSize: 22, fontWeight: 800, cursor: 'pointer', lineHeight: 1 }}
        >
          ×
        </button>
        {children}
      </div>
    </div>
  )
}

function Section({ title, children }: { readonly title: string; readonly children: ReactNode }): ReactElement {
  return (
    <section aria-label={title} style={{ background: '#FFFFFF', border: '1px solid #F1ECE0', borderRadius: 20, padding: '14px 16px', marginTop: 14, textAlign: 'left' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.09em', textTransform: 'uppercase', fontWeight: 700, color: '#A99F8B', marginBottom: 6 }}>{title}</div>
      {children}
    </section>
  )
}

function ProgressBar({ badge }: { readonly badge: BadgeRecord }): ReactElement | null {
  const text = progressText(badge)
  if (text === null) return null
  const pct = Math.round(progressFraction(badge) * 100)
  const toGo = toGoText(badge)
  return (
    <div style={{ marginTop: 10 }}>
      <div role="progressbar" aria-label={`Progress toward ${badge.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-valuetext={text} style={{ height: 14, borderRadius: 9999, background: '#EFEAE0', overflow: 'hidden' }}>
        <div style={{ width: `${String(pct)}%`, height: '100%', borderRadius: 9999, background: 'linear-gradient(90deg, #8FE36B, #3FB31B)' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 6, fontSize: 13, fontWeight: 700 }}>
        <span style={{ color: '#515E71' }}>{text}</span>
        {toGo !== null && <span style={{ color: '#3FA51B' }}>{toGo}</span>}
      </div>
    </div>
  )
}

function ArtSection({ badge, paint, onPaint }: { readonly badge: BadgeRecord; readonly paint: PaintState; readonly onPaint: () => void }): ReactElement {
  const note = { fontSize: 14, color: '#515E71', margin: 0 } as const
  if (paint === 'painting' || badge.art_status === 'pending') {
    return (
      <Section title="Your own badge art">
        <p role="status" className="badge-art-shimmer" style={note}>
          Painting your one-of-a-kind badge… this takes a few seconds.
        </p>
      </Section>
    )
  }
  if (badge.art_status === 'ready') {
    return (
      <Section title="Your own badge art">
        <p style={note}>This badge was painted just for you. No one else has one like it!</p>
      </Section>
    )
  }
  return (
    <Section title="Your own badge art">
      <p style={{ ...note, marginBottom: 10 }}>{paint === 'failed' || badge.art_status === 'failed' ? 'The paint got smudged. Want to try again?' : 'Get a picture painted just for you, for this badge.'}</p>
      <DenButton label={paint === 'failed' || badge.art_status === 'failed' ? 'Try painting again' : 'Paint my badge'} variant="blue" shape="pill" size="md" onClick={onPaint} />
    </Section>
  )
}

export function BadgeDetail({ badge, paint, onPaint, onClose, animate }: BadgeDetailProps): ReactElement {
  const tier = TIER_STYLES[badge.tier]
  const best = bestSoFarText(badge)
  return (
    <Dialog label={badge.name} onClose={onClose}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <BadgeMedal badge={badge} size={168} animate={animate} />
        </div>
        <div style={{ marginTop: 10, display: 'inline-flex', gap: 6, fontSize: 12, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          <span style={{ padding: '4px 10px', borderRadius: 9999, background: tier.rim[1], color: badge.tier === 'silver' ? '#2A2E37' : '#FFFFFF' }}>{tier.label}</span>
          <span style={{ padding: '4px 10px', borderRadius: 9999, background: '#F1ECE0', color: '#6B6250' }}>{CATEGORY_STYLES[badge.category].label}</span>
        </div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 30, lineHeight: 1.1, color: '#2A2E37', margin: '10px 0 0' }}>
          {badge.name}
        </h2>
        <div style={{ fontSize: 14, fontWeight: 700, marginTop: 4, color: badge.earned ? '#3FA51B' : '#A99F8B' }}>{badge.earned ? earnedWhenText(badge) : 'Not earned yet'}</div>
      </div>

      {badge.earned ? (
        <>
          <Section title="Why you got it">
            <p style={{ fontSize: 17, fontWeight: 700, color: '#2A2E37', margin: 0 }}>{badge.earned_reason ?? badge.description}</p>
            {best !== null && <p style={{ fontSize: 14, color: '#515E71', margin: '6px 0 0' }}>{best}</p>}
          </Section>
          <ArtSection badge={badge} paint={paint} onPaint={onPaint} />
        </>
      ) : (
        <Section title="How to get it">
          <p style={{ fontSize: 17, fontWeight: 700, color: '#2A2E37', margin: 0 }}>{badge.description}</p>
          <ProgressBar badge={badge} />
        </Section>
      )}
    </Dialog>
  )
}
