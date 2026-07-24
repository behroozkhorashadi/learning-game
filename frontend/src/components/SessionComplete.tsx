import { useState } from 'react'
import { SparklesIcon } from './icons'

/**
 * Session wrap-up — ported from the Claude Design handoff bundle
 * (`Session Flow.dc.html` "WRAP-UP" section and `Rating & Summary.dc.html`
 * "SESSION SUMMARY & REWARD" section, combined into one simplified screen).
 * Rewards aren't persisted anywhere yet (no backend model for it), so this is
 * a celebratory one-off shown at the end of the current session only.
 */

const SPARKLES = [
  { left: '14%', top: '16%', color: '#5BCC2D', delay: '0.1s' },
  { left: '83%', top: '20%', color: '#E057B0', delay: '0.7s' },
  { left: '22%', top: '64%', color: '#5C85FF', delay: '0.9s' },
  { left: '78%', top: '60%', color: '#F59E0B', delay: '0.3s' },
]

interface Props {
  headline: string
  subtitle: string
  badgeSrc: string
  badgeTitle: string
  words: string[]
  onPlayAgain: () => void
  onAllDone: () => void
}

function BadgeArt({ src, title }: { src: string; title: string }) {
  const [broken, setBroken] = useState(false)
  const boxStyle = {
    width: 150,
    height: 150,
    margin: '0 auto 22px',
    borderRadius: 36,
    background: '#F6F0FF',
    border: '1px solid #EBDCFE',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    animation: 'rewardIn 0.7s cubic-bezier(0.2,0,0,1) 0.1s both',
  }

  if (broken) {
    return (
      <div style={boxStyle}>
        <SparklesIcon size={56} />
      </div>
    )
  }

  return (
    <div style={boxStyle}>
      <img src={src} alt={title} onError={() => setBroken(true)} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
    </div>
  )
}

export function SessionComplete({ headline, subtitle, badgeSrc, badgeTitle, words, onPlayAgain, onAllDone }: Props) {
  return (
    <div style={{ position: 'relative', background: '#FFF6EA', border: '1px solid #F1ECE0', borderRadius: 32, padding: '44px 40px', boxShadow: '0 22px 44px -16px rgba(0,13,51,0.14), 0 2px 0 rgba(0,13,51,0.03)', overflow: 'hidden', boxSizing: 'border-box' }}>
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        {SPARKLES.map((s, i) => (
          <span key={i} style={{ position: 'absolute', left: s.left, top: s.top, color: s.color, animation: `sparkleUp 1.6s ease-out ${s.delay} infinite` }}>
            <SparklesIcon size={20} />
          </span>
        ))}
      </div>

      <div style={{ textAlign: 'center', position: 'relative' }}>
        <BadgeArt src={badgeSrc} title={badgeTitle} />
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.09em', textTransform: 'uppercase', fontWeight: 700, color: '#9D57FA' }}>New reward unlocked</div>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 40, lineHeight: 1.05, color: '#2A2E37', marginTop: 6 }}>{badgeTitle}</div>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 26, lineHeight: 1.15, color: '#2A2E37', marginTop: 22 }}>{headline}</div>
        <div style={{ marginTop: 10, fontSize: 18, color: '#8896AA' }}>{subtitle}</div>
      </div>

      <div style={{ background: '#FBF8F2', border: '1px dashed #EEE4D2', borderRadius: 20, padding: '20px 22px', margin: '30px 0 0' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 700, color: '#98A2B3', marginBottom: 12 }}>Words you built</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {words.map((w, i) => (
            <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 42, padding: '0 16px', borderRadius: 9999, background: '#FFFFFF', border: '1px solid #EEE4D2', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18, color: '#2A2E37' }}>
              {w}
            </span>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginTop: 28, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={onPlayAgain}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 10, height: 60, padding: '0 26px', borderRadius: 9999, background: '#FFFFFF', border: '2px solid #E7E2D6', color: '#515E71', fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 18, cursor: 'pointer' }}
        >
          Play again
        </button>
        <button
          type="button"
          onClick={onAllDone}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 10, height: 60, padding: '0 36px', borderRadius: 9999, background: '#144FFF', border: 'none', color: '#FFFFFF', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 20, cursor: 'pointer', boxShadow: '0 6px 0 #0037DB' }}
        >
          All done
        </button>
      </div>
    </div>
  )
}
