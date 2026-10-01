import { useEffect, useState } from 'react'
import type { Profile } from '../types/generated'

/**
 * Profile picker — ported from the Claude Design handoff bundle
 * (`Entry Screens.dc.html`, "PROFILE PICKER" section). Lists real profiles
 * from `GET /api/profiles`; picking one is purely a client-side navigation
 * choice, nothing the server needs to know about ahead of time.
 */

export const PENCIL_ICON = 'M4.75 19.25L9 18.25L18.29 8.96C18.68 8.57 18.68 7.93 18.29 7.54L16.46 5.71C16.07 5.32 15.43 5.32 15.04 5.71L5.75 15L4.75 19.25ZM14 7L17 10'

const RING_THEMES = [
  { ring: '#EBDCFE', lip: '#CBA6FC', text: '#5006B2' },
  { ring: '#DBE4FF', lip: '#A3BAFF', text: '#00289E' },
  { ring: '#DBF5D1', lip: '#A1E486', text: '#2C6416' },
]

interface Props {
  onSelect: (profile: Profile) => void
  onAddPlayer: () => void
  onEditProfile: (profile: Profile) => void
  onOpenAdmin: () => void
}

/** `profile.avatar` is a bare key (e.g. `"fox"`, `"rami"`), not a path —
 * this looks it up under `/images/avatars/<avatar>.png` and falls back to
 * the profile's own initial (the picker's original look) if that key has
 * no real art yet, the same `onError`-driven pattern `SessionStart.tsx`'s
 * `HeroArt` already uses for missing badge art. */
export function ProfileAvatar({ avatar, name }: { avatar: string; name: string }) {
  const [broken, setBroken] = useState(false)

  if (broken) {
    return <>{name.charAt(0).toUpperCase()}</>
  }

  return (
    <img
      src={avatar.startsWith('/static/') ? avatar : `/images/avatars/${avatar}.png`}
      alt=""
      onError={() => setBroken(true)}
      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
    />
  )
}

export function ProfilePicker({ onSelect, onAddPlayer, onEditProfile, onOpenAdmin }: Props) {
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
              <div key={p.id} style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => p.id != null && onSelect(p)}
                  aria-label={`Play as ${p.name}`}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, background: 'transparent', border: 'none', cursor: 'pointer', padding: 8 }}
                >
                  <div style={{ width: 150, height: 150, borderRadius: 9999, padding: 6, background: theme.ring, boxShadow: `0 8px 0 ${theme.lip}`, boxSizing: 'border-box' }}>
                    <div style={{ width: '100%', height: '100%', borderRadius: 9999, overflow: 'hidden', background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 52, color: theme.text }}>
                      <ProfileAvatar avatar={p.avatar} name={p.name} />
                    </div>
                  </div>
                  <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 24, color: 'var(--fg-primary)' }}>{p.name}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onEditProfile(p)}
                  aria-label={`Edit ${p.name}`}
                  title={`Edit ${p.name}`}
                  style={{ position: 'absolute', top: 8, right: 4, width: 40, height: 40, borderRadius: 9999, border: '2px solid var(--border-default)', background: 'var(--surface-default)', color: 'var(--fg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                >
                  <svg width={18} height={18} viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d={PENCIL_ICON} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            )
          })}

          {profiles != null && (
            <button
              type="button"
              onClick={onAddPlayer}
              aria-label="Add a player"
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, background: 'transparent', border: 'none', cursor: 'pointer', padding: 8 }}
            >
              <div
                style={{
                  width: 150,
                  height: 150,
                  borderRadius: 9999,
                  boxSizing: 'border-box',
                  border: '3px dashed var(--border-default)',
                  background: 'var(--surface-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 52,
                  fontWeight: 800,
                  color: 'var(--fg-tertiary)',
                }}
              >
                +
              </div>
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 24, color: 'var(--fg-tertiary)' }}>Add a player</span>
            </button>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={onOpenAdmin}
        style={{
          position: 'fixed',
          bottom: 16,
          left: 20,
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          fontSize: 13,
          color: 'var(--fg-disabled)',
        }}
      >
        Admin
      </button>
    </div>
  )
}
