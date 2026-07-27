import { CircleCheckIcon } from './icons'
import { DenButton } from './den/DenButton'

/**
 * Session progress bar — ported from the Claude Design handoff bundle
 * (`Session Flow.dc.html`, "PROGRESS" section). Shows one dot per item in
 * the session: done (green check), current (pulsing blue), upcoming (gray).
 */

const BACK_ICON = ['M10.25 6.75L4.75 12L10.25 17.25M19.25 12H5']

interface Props {
  total: number
  /** 0-based index of the item currently being worked on. */
  currentIndex: number
  onBack: () => void
}

export function ProgressBar({ total, currentIndex, onBack }: Props) {
  return (
    <div style={{ background: '#FFF6EA', border: '1px solid #F1ECE0', borderRadius: 28, padding: '22px 24px', boxShadow: '0 10px 24px -14px rgba(0,13,51,0.12)', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <DenButton label="Back" variant="quiet" shape="pill" size="md" iconOnly iconPaths={BACK_ICON} onClick={onBack} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }} aria-label={`Item ${currentIndex + 1} of ${total}`}>
          {Array.from({ length: total }, (_, i) => {
            if (i < currentIndex) {
              return (
                <span key={i} style={{ width: 26, height: 26, borderRadius: 9999, background: '#5BCC2D', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#FFFFFF', flex: 'none' }}>
                  <CircleCheckIcon size={16} />
                </span>
              )
            }
            if (i === currentIndex) {
              return <span key={i} style={{ width: 18, height: 18, borderRadius: 9999, background: '#144FFF', animation: 'pulseRing 1.6s ease-out infinite', flex: 'none' }} />
            }
            return <span key={i} style={{ width: 13, height: 13, borderRadius: 9999, background: '#E4DCCB', flex: 'none' }} />
          })}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 52, padding: '0 18px', borderRadius: 9999, background: '#FBF8F2', border: '1px solid #EEE4D2', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18, flex: 'none' }}>
          <span style={{ color: '#2A2E37' }}>{Math.min(currentIndex + 1, total)}</span>
          <span style={{ color: '#B7AC96' }}>/ {total}</span>
        </div>
      </div>
    </div>
  )
}
