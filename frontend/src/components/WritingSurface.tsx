import { useState } from 'react'
import { DenButton } from './den/DenButton'
import { DenJar } from './den/DenJar'

/**
 * Drafting view — ported from the Claude Design handoff bundle
 * (`Writing Surface & Coach.dc.html`, "1a — writing surface" section).
 * Every writing game reuses this: a quiet, mechanics-only draft surface that
 * gates the coached revision pass (`CoachPanel`) behind a word-goal.
 */

const SPARKLE_ICON = [
  'M17 4.75C17 5.89705 15.8971 7 14.75 7C15.8971 7 17 8.10295 17 9.25C17 8.10295 18.1029 7 19.25 7C18.1029 7 17 5.89705 17 4.75Z',
  'M17 14.75C17 15.8971 15.8971 17 14.75 17C15.8971 17 17 18.1029 17 19.25C17 18.1029 18.1029 17 19.25 17C18.1029 17 17 15.8971 17 14.75Z',
  'M9 7.75C9 9.91666 6.91666 12 4.75 12C6.91666 12 9 14.0833 9 16.25C9 14.0833 11.0833 12 13.25 12C11.0833 12 9 9.91666 9 7.75Z',
]
const BACK_ARROW_ICON = ['M9.25 4.75L4.75 9L9.25 13.25', 'M5.5 9H15.25C17.4591 9 19.25 10.7909 19.25 13V19.25']

function wordCountOf(text: string): number {
  const trimmed = text.trim()
  return trimmed ? trimmed.split(/\s+/).length : 0
}

interface Props {
  briefTitle: string
  briefBody: string
  briefChips: string[]
  value: string
  onChange: (text: string) => void
  wordGoal?: number
  onPolish: () => void
  onKeepWriting?: () => void
}

export function WritingSurface({ briefTitle, briefBody, briefChips, value, onChange, wordGoal = 120, onPolish, onKeepWriting }: Props) {
  const [briefOpen, setBriefOpen] = useState(true)
  const [confirming, setConfirming] = useState(false)

  const wordCount = wordCountOf(value)
  const goalMet = wordCount >= wordGoal
  const footerHint = wordCount === 0
    ? 'Nothing to fix yet — just start.'
    : goalMet
      ? 'The jar is full — but you can always add more.'
      : 'Keep going. I only flag spelling while you draft.'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ background: '#FFFDF8', border: '1px solid #EDE5D5', borderRadius: 28, overflow: 'hidden', boxShadow: '0 24px 48px -20px rgba(0,13,51,.16)', boxSizing: 'border-box' }}>
        <div style={{ borderBottom: '1px solid #F0E9DA', background: '#FBF6EC' }}>
          <button
            type="button"
            onClick={() => setBriefOpen((v) => !v)}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '16px 26px', background: 'transparent', border: 0, cursor: 'pointer', textAlign: 'left' }}
          >
            <div style={{ width: 26, height: 26, borderRadius: 8, background: '#EBDCFE', color: '#7A3FD4', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                {SPARKLE_ICON.map((d, i) => (
                  <path key={i} d={d} stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                ))}
              </svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', fontWeight: 700, color: '#A99F8B' }}>Your brief</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#3B3F49', marginTop: 2 }}>{briefTitle}</div>
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: '#9A907C' }}>{briefOpen ? 'Hide' : 'Show'}</div>
          </button>
          {briefOpen && (
            <div style={{ padding: '0 26px 20px 64px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ fontSize: 15, lineHeight: 1.6, color: '#5C5849' }}>{briefBody}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {briefChips.map((label) => (
                  <div key={label} style={{ fontSize: 13, fontWeight: 700, color: '#6B6455', background: '#FFFFFF', border: '1px solid #EDE3D0', borderRadius: 9999, padding: '7px 13px' }}>
                    {label}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 128px', gap: 0, alignItems: 'stretch' }}>
          <div style={{ padding: '34px 32px 28px', minHeight: 340 }}>
            <textarea
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="Start anywhere. The middle is fine too."
              style={{
                width: '100%',
                minHeight: 280,
                border: 'none',
                outline: 'none',
                resize: 'vertical',
                background: 'transparent',
                fontFamily: 'var(--font-sans)',
                fontSize: 20,
                lineHeight: 1.75,
                color: '#2F333C',
                letterSpacing: '.002em',
              }}
            />
          </div>
          <div style={{ borderLeft: '1px solid #F0E9DA', background: '#FCFAF4', padding: '26px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <DenJar count={wordCount} goal={wordGoal} caption={goalMet ? 'jar is full!' : 'words so far'} />
          </div>
        </div>

        <div style={{ borderTop: '1px solid #F0E9DA', background: '#FBF6EC', padding: '16px 26px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#9A907C' }}>{footerHint}</div>
          <DenButton label={goalMet ? 'Ready to polish →' : 'Ready to polish'} variant="primary" disabled={!goalMet} onClick={() => setConfirming(true)} />
        </div>
      </div>

      {confirming && (
        <div style={{ background: '#FFFDF8', border: '1px solid #EDE5D5', borderRadius: 24, padding: '28px 30px', boxShadow: '0 20px 40px -18px rgba(0,13,51,.18)', display: 'flex', alignItems: 'center', gap: 22, maxWidth: 640, boxSizing: 'border-box' }}>
          <div style={{ width: 52, height: 52, borderRadius: 16, background: '#EBDCFE', color: '#7A3FD4', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              {SPARKLE_ICON.map((d, i) => (
                <path key={i} d={d} stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
              ))}
            </svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 19, color: '#2A2E37' }}>Ready to polish it?</div>
            <div style={{ fontSize: 14, lineHeight: 1.5, color: '#7C7466', marginTop: 5 }}>
              I'll read what you wrote and ask you a couple of questions. You can keep writing after — nothing gets locked.
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 'none' }}>
            <DenButton label="Yes, polish it" variant="primary" size="sm" onClick={onPolish} />
            <DenButton
              label="Keep writing"
              variant="ghost"
              size="sm"
              iconPaths={BACK_ARROW_ICON}
              onClick={() => {
                setConfirming(false)
                onKeepWriting?.()
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
