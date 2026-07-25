import { SpeakerIcon } from './icons'
import { speakWord } from '../lib/speech'

/**
 * Paper-and-pencil handoff prompt — ported from the Claude Design handoff
 * bundle (`Handoff & Parent Verify.dc.html`, "GRAB YOUR PENCIL" section).
 * Shown once per session, after the last digital word, before the PIN-gated
 * `ParentVerify` step.
 */

function ArrowRightIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M4.75 12H19.25M13.75 6.75L19.25 12L13.75 17.25" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

interface Props {
  word: string
  onWroteIt: () => void
}

export function HandoffPencil({ word, onWroteIt }: Props) {
  return (
    <div style={{ background: 'var(--surface-default)', border: '1px solid var(--border-subtle)', borderRadius: 32, padding: '44px 40px', boxShadow: 'var(--elevation-300)', boxSizing: 'border-box' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.09em', textTransform: 'uppercase', fontWeight: 700, color: 'var(--fg-tertiary)' }}>
          Now on paper
        </div>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 32, lineHeight: 1.1, color: 'var(--fg-primary)', marginTop: 8 }}>
          Write it with your pencil
        </div>
      </div>

      <div style={{ background: 'var(--surface-subtle)', border: '1px dashed var(--border-tray)', borderRadius: 20, padding: '26px 24px', margin: '28px 0 0', textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 700, color: 'var(--fg-tertiary)', marginBottom: 10 }}>
          Write this word:
        </div>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 44, color: 'var(--fg-primary)' }}>{word}</div>
        <div
          style={{
            width: 160,
            height: 4,
            margin: '18px auto 0',
            backgroundImage: 'repeating-linear-gradient(90deg, #C2D1FF 0 14px, transparent 14px 22px)',
            backgroundSize: '32px 4px',
            animation: 'dashMove 1.1s linear infinite',
          }}
        />
      </div>

      <div style={{ textAlign: 'center', marginTop: 22, fontSize: 16, lineHeight: '22px', color: 'var(--fg-tertiary)' }}>
        Take your paper and pencil. When you've written it, ask a grown-up to check.
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginTop: 30, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => speakWord(word)}
          aria-label="Hear the word"
          title="Hear the word"
          style={{ width: 60, height: 60, borderRadius: 9999, border: '2px solid #C2D1FF', background: '#F0F4FF', color: '#144FFF', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flex: 'none' }}
        >
          <SpeakerIcon size={28} />
        </button>
        <button
          type="button"
          onClick={onWroteIt}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 10, height: 60, padding: '0 32px', borderRadius: 9999, background: '#144FFF', border: 'none', color: '#FFFFFF', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 20, cursor: 'pointer', boxShadow: '0 6px 0 #0037DB' }}
        >
          I wrote it
          <ArrowRightIcon />
        </button>
      </div>
    </div>
  )
}
