import { useState } from 'react'
import { SpeakerIcon, PlayIcon, SparklesIcon } from './icons'
import { speakText } from '../lib/speech'

/**
 * Session intro — ported from the Claude Design handoff bundle
 * (`Session Flow.dc.html`, "START" section). Shown once at the beginning of
 * each session, before the first item loads.
 */

interface Props {
  eyebrow: string
  headline: string
  subtitle: string
  sessionLength: number
  heroSrc: string
  onStart: () => void
}

function HeroArt({ src }: { src: string }) {
  const [broken, setBroken] = useState(false)
  const boxStyle = {
    width: 168,
    height: 168,
    margin: '0 auto 26px',
    borderRadius: 36,
    background: '#F0F4FF',
    border: '1px solid #E1E9FF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    animation: 'floaty 4s ease-in-out infinite',
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
      <img src={src} alt="" onError={() => setBroken(true)} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
    </div>
  )
}

export function SessionStart({ eyebrow, headline, subtitle, sessionLength, heroSrc, onStart }: Props) {
  return (
    <div style={{ position: 'relative', background: '#FFF6EA', border: '1px solid #F1ECE0', borderRadius: 32, padding: '48px 40px 44px', boxShadow: '0 22px 44px -16px rgba(0,13,51,0.14), 0 2px 0 rgba(0,13,51,0.03)', textAlign: 'center', overflow: 'hidden', boxSizing: 'border-box' }}>
      <div style={{ position: 'absolute', top: 26, right: 26 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 38, padding: '0 16px', borderRadius: 9999, background: '#FDECCE', color: '#7F5305', fontWeight: 700, fontSize: 15 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M12 4.75L13.94 9.03L18.6 9.54L15.1 12.66L16.09 17.25L12 14.9L7.91 17.25L8.9 12.66L5.4 9.54L10.06 9.03L12 4.75Z" fill="#F7B23B" stroke="#F7B23B" strokeWidth="1.5" strokeLinejoin="round" />
          </svg>
          <span>0 / {sessionLength}</span>
        </div>
      </div>

      <HeroArt src={heroSrc} />

      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.09em', textTransform: 'uppercase', fontWeight: 700, color: '#98A2B3', marginBottom: 10 }}>
        {eyebrow}
      </div>
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 46, lineHeight: 1.04, color: '#2A2E37' }}>{headline}</div>
      <div style={{ marginTop: 12, fontSize: 19, lineHeight: '26px', color: '#8896AA', maxWidth: 420, marginLeft: 'auto', marginRight: 'auto' }}>
        {subtitle}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, margin: '26px 0 30px' }} aria-label={`${sessionLength} words in this set`}>
        {Array.from({ length: sessionLength }, (_, i) => (
          <span key={i} style={{ width: 14, height: 14, borderRadius: 9999, background: '#E4DCCB' }} />
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <button
          type="button"
          onClick={() => speakText(subtitle)}
          aria-label="Hear how to play"
          title="Hear how to play"
          style={{ width: 64, height: 64, borderRadius: 9999, border: '2px solid #C2D1FF', background: '#F0F4FF', color: '#144FFF', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flex: 'none' }}
        >
          <SpeakerIcon size={30} />
        </button>
        <button
          type="button"
          onClick={onStart}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 12, height: 64, padding: '0 40px', borderRadius: 9999, background: '#144FFF', border: 'none', color: '#FFFFFF', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 23, cursor: 'pointer', boxShadow: '0 7px 0 #0037DB' }}
        >
          <PlayIcon size={26} />
          <span>Start</span>
        </button>
      </div>
    </div>
  )
}
