import { DenButton } from './den/DenButton'
import { speakWord } from '../lib/speech'

/**
 * Paper-and-pencil handoff prompt — ported from the Claude Design handoff
 * bundle (`Handoff & Parent Verify.dc.html`, "GRAB YOUR PENCIL" section).
 * Shown once per session, after the last digital word, before the PIN-gated
 * `ParentVerify` step.
 */

const SPEAKER_ICON = [
  'M15.75 10.75C15.75 10.75 16.25 11.234 16.25 12C16.25 12.766 15.75 13.25 15.75 13.25M17.75 7.75C17.75 7.75 19.25 9 19.25 11.999C19.25 14.997 17.75 16.25 17.75 16.25M13.25 4.75L8.5 8.75H5.75C5.48478 8.75 5.23043 8.85536 5.04289 9.04289C4.85536 9.23043 4.75 9.48478 4.75 9.75V14.25C4.75 14.5152 4.85536 14.7696 5.04289 14.9571C5.23043 15.1446 5.48478 15.25 5.75 15.25H8.5L13.25 19.25V4.75Z',
]

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
        <DenButton
          label="Hear the word"
          variant="softBlue"
          shape="pill"
          size="lg"
          iconOnly
          iconSize={28}
          iconPaths={SPEAKER_ICON}
          onClick={() => speakWord(word)}
        />
        <DenButton label="I wrote it" variant="blue" shape="pill" size="lg" lipColor="#0037DB" onClick={onWroteIt} />
      </div>
    </div>
  )
}
