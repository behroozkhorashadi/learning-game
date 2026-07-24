import { useEffect, useState } from 'react'
import type { Profile } from '../types/generated'

/**
 * Profile picker — ported from the Claude Design handoff bundle
 * (`Entry Screens.dc.html`, "PROFILE PICKER" section). Lists real profiles
 * from `GET /api/profiles`; picking one is purely a client-side navigation
 * choice, nothing the server needs to know about ahead of time.
 */

const RING_THEMES = [
  { ring: '#EBDCFE', lip: '#CBA6FC', text: '#5006B2' },
  { ring: '#DBE4FF', lip: '#A3BAFF', text: '#00289E' },
  { ring: '#DBF5D1', lip: '#A1E486', text: '#2C6416' },
]

interface Props {
  onSelect: (profile: Profile) => void
}

export function ProfilePicker({ onSelect }: Props) {
  const [profiles, setProfiles] = useState<Profile[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/profiles')
      .then((res) => {
        if (!res.ok) throw new Error(`GET /api/profiles -> ${res.status}`)
        return res.json()
      })
      .then(setProfiles)
      .catch((err) => setError(String(err)))
  }, [])

  return (
    <div style={{ minHeight: '100%', boxSizing: 'border-box', background: 'var(--surface-app)', display: 'flex', justifyContent: 'center', padding: '56px 24px' }}>
      <div style={{ width: '100%', maxWidth: 820, background: 'var(--surface-default)', border: '1px solid var(--border-subtle)', borderRadius: 32, padding: '52px 44px', boxShadow: 'var(--elevation-600)', textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 40, lineHeight: 1.05, color: 'var(--fg-primary)' }}>
          Who&apos;s playing?
        </div>
        <div style={{ marginTop: 10, fontSize: 18, color: 'var(--fg-tertiary)' }}>Tap your face to start.</div>

        {error && (
          <pre style={{ marginTop: 24, color: '#CD2A20', background: '#FDF2F2', padding: 12, borderRadius: 12, textAlign: 'left' }}>Error: {error}</pre>
        )}

        <div style={{ display: 'flex', justifyContent: 'center', gap: 28, flexWrap: 'wrap', marginTop: 40 }}>
          {(profiles ?? []).map((p, i) => {
            const theme = RING_THEMES[i % RING_THEMES.length]
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => p.id != null && onSelect(p)}
                aria-label={`Play as ${p.name}`}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, background: 'transparent', border: 'none', cursor: 'pointer', padding: 8 }}
              >
                <div style={{ width: 150, height: 150, borderRadius: 9999, padding: 6, background: theme.ring, boxShadow: `0 8px 0 ${theme.lip}`, boxSizing: 'border-box' }}>
                  <div style={{ width: '100%', height: '100%', borderRadius: 9999, overflow: 'hidden', background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 52, color: theme.text }}>
                    {p.name.charAt(0).toUpperCase()}
                  </div>
                </div>
                <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 24, color: 'var(--fg-primary)' }}>{p.name}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
