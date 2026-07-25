import { useState } from 'react'
import { ImagePlaceholderIcon } from './icons'

/**
 * PIN-gated parent verification — ported from the Claude Design handoff
 * bundle (`Handoff & Parent Verify.dc.html`, "PARENT VERIFY (PIN-GATED)"
 * section). The PIN is a lightweight kid-deterrent, not a security boundary
 * (the design's own mock hardcodes it client-side too) — it just keeps a
 * curious kid from self-grading before a grown-up looks.
 */

const PIN = '1234'
const PIN_LENGTH = 4

function LockIcon({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="5.75" y="10.75" width="12.5" height="9.5" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8.25 10.75V7.75C8.25 5.67893 9.92893 4 12 4C14.0711 4 15.75 5.67893 15.75 7.75V10.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="12" cy="15.25" r="1.25" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

function CheckIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M5 12.5L9.5 17L19 6.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function CrossIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M6 6L18 18M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'del']

interface Props {
  word: string
  kidName?: string
  onResult: (correct: boolean) => void
}

export function ParentVerify({ word, kidName, onResult }: Props) {
  const [entry, setEntry] = useState('')
  const [unlocked, setUnlocked] = useState(false)
  const [error, setError] = useState(false)
  const [shake, setShake] = useState(false)

  function pressKey(key: string) {
    if (key === 'clear') {
      setEntry('')
      return
    }
    if (key === 'del') {
      setEntry((prev) => prev.slice(0, -1))
      return
    }
    if (entry.length >= PIN_LENGTH) return

    const next = entry + key
    setEntry(next)
    if (next.length === PIN_LENGTH) {
      if (next === PIN) {
        setUnlocked(true)
        setError(false)
        setEntry('')
      } else {
        setError(true)
        setShake(true)
        setTimeout(() => {
          setShake(false)
          setEntry('')
        }, 500)
      }
    }
  }

  if (!unlocked) {
    return (
      <div style={{ background: 'var(--surface-default)', border: '1px solid var(--border-subtle)', borderRadius: 32, padding: '44px 40px', boxShadow: 'var(--elevation-300)', boxSizing: 'border-box' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 64, height: 64, margin: '0 auto 16px', borderRadius: 9999, background: '#F0F4FF', color: '#144FFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <LockIcon />
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 26, color: 'var(--fg-primary)' }}>Grown-up check</div>
          <div style={{ marginTop: 6, fontSize: 16, color: 'var(--fg-tertiary)' }}>Enter your PIN to confirm the word is written correctly.</div>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 14,
            margin: '28px 0 8px',
            animation: shake ? 'shakeX 0.4s ease-in-out' : undefined,
          }}
        >
          {Array.from({ length: PIN_LENGTH }, (_, i) => (
            <span
              key={i}
              style={{
                width: 18,
                height: 18,
                borderRadius: 9999,
                background: i < entry.length ? '#144FFF' : 'var(--surface-subtle)',
                border: '2px solid ' + (i < entry.length ? '#144FFF' : 'var(--border-tray)'),
              }}
            />
          ))}
        </div>

        <div style={{ textAlign: 'center', height: 20, fontSize: 14, fontWeight: 700, color: '#CD2A20' }}>
          {error ? 'Wrong PIN — try again' : ''}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 64px)', gap: 12, justifyContent: 'center', marginTop: 16 }}>
          {KEYS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => pressKey(key)}
              aria-label={key === 'del' ? 'Delete' : key === 'clear' ? 'Clear' : key}
              style={{
                width: 64,
                height: 64,
                borderRadius: 18,
                border: '1px solid var(--border-subtle)',
                background: key === 'clear' || key === 'del' ? 'var(--surface-subtle)' : 'var(--surface-default)',
                color: 'var(--fg-primary)',
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                fontSize: key === 'clear' || key === 'del' ? 13 : 22,
                cursor: 'pointer',
              }}
            >
              {key === 'del' ? '⌫' : key === 'clear' ? 'Clear' : key}
            </button>
          ))}
        </div>

        <div style={{ textAlign: 'center', marginTop: 22, fontSize: 13, color: 'var(--fg-disabled)' }}>
          Made for grown-ups · the answer stays hidden from kids
        </div>
      </div>
    )
  }

  return (
    <div style={{ background: 'var(--surface-default)', border: '1px solid var(--border-subtle)', borderRadius: 32, padding: '44px 40px', boxShadow: 'var(--elevation-300)', boxSizing: 'border-box' }}>
      <div style={{ textAlign: 'center' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', height: 30, padding: '0 14px', borderRadius: 9999, background: '#E7F7EA', color: '#1F9D4C', fontSize: 13, fontWeight: 700 }}>
          Unlocked for grown-ups
        </span>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 26, color: 'var(--fg-primary)', marginTop: 14 }}>
          Did {kidName ? kidName : 'they'} write it correctly?
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 20, background: 'var(--surface-subtle)', border: '1px dashed var(--border-tray)', borderRadius: 20, padding: '20px 22px', margin: '26px 0 0' }}>
        <div style={{ flex: 'none', width: 72, height: 72, borderRadius: 16, background: 'var(--surface-default)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--fg-disabled)' }}>
          <ImagePlaceholderIcon size={28} />
        </div>
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 700, color: 'var(--fg-tertiary)' }}>The word was</div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 28, color: 'var(--fg-primary)', marginTop: 4 }}>{word}</div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginTop: 28, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => onResult(false)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 10, height: 60, padding: '0 26px', borderRadius: 9999, background: '#FFFFFF', border: '2px solid #E7E2D6', color: '#515E71', fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 18, cursor: 'pointer' }}
        >
          <CrossIcon size={18} />
          Not yet
        </button>
        <button
          type="button"
          onClick={() => onResult(true)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 10, height: 60, padding: '0 36px', borderRadius: 9999, background: '#1F9D4C', border: 'none', color: '#FFFFFF', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 20, cursor: 'pointer', boxShadow: '0 6px 0 #14733A' }}
        >
          <CheckIcon />
          Correct
        </button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
        <button
          type="button"
          onClick={() => setUnlocked(false)}
          style={{ background: 'none', border: 'none', color: 'var(--fg-tertiary)', fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 14, cursor: 'pointer', padding: '8px 12px' }}
        >
          Lock again
        </button>
      </div>
    </div>
  )
}
