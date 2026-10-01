import { useState } from 'react'
import { DenButton } from '../components/den/DenButton'
import { CardShell } from '../components/AdminLoginForm'
import { ProfileAvatar } from './ProfilePicker'
import type { Profile, ProfileUnlockRequest } from '../types/generated'

/**
 * Password prompt for a protected profile — shown when a kid picks it on
 * ProfilePicker, or taps its edit pencil. Checks with POST
 * /api/profiles/{id}/unlock, which also accepts the admin password as an
 * override (see backend/app/services/profile_passwords.py). The accepted
 * password is handed back so App can send it on later edits.
 */

interface Props {
  profile: Profile
  onUnlocked: (password: string) => void
  onCancel: () => void
}

export function ProfileUnlock({ profile, onUnlocked, onCancel }: Props) {
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    if (!password || submitting) return
    setSubmitting(true)
    setError(null)
    const payload: ProfileUnlockRequest = { password }
    try {
      const res = await fetch(`/api/profiles/${profile.id}/unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.status === 401) {
        setError("That's not it. Try again!")
        setPassword('')
        return
      }
      if (!res.ok) throw new Error(`POST /api/profiles/${profile.id}/unlock -> ${res.status}`)
      onUnlocked(password)
    } catch (err) {
      setError(String(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <CardShell>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: 112, height: 112, borderRadius: 9999, overflow: 'hidden', background: 'var(--surface-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 44, color: 'var(--fg-brand)' }}>
          <ProfileAvatar avatar={profile.avatar} name={profile.name} />
        </div>
      </div>
      <div style={{ marginTop: 20, fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 32, color: 'var(--fg-primary)', textAlign: 'center' }}>
        Hi {profile.name}!
      </div>
      <div style={{ marginTop: 8, fontSize: 16, color: 'var(--fg-tertiary)', textAlign: 'center' }}>Type your password to keep going.</div>

      <input
        type="password"
        aria-label="Password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void handleSubmit()
        }}
        autoFocus
        autoComplete="current-password"
        style={{
          width: '100%',
          boxSizing: 'border-box',
          marginTop: 28,
          padding: '14px 16px',
          fontSize: 16,
          borderRadius: 14,
          border: '2px solid var(--border-default)',
          background: 'var(--surface-subtle)',
          color: 'var(--fg-primary)',
          outline: 'none',
        }}
      />

      {error && <div role="alert" style={{ marginTop: 16, color: '#CD2A20', background: '#FDF2F2', padding: 12, borderRadius: 12 }}>{error}</div>}

      <div style={{ display: 'flex', gap: 12, marginTop: 28 }}>
        <DenButton label="Back" variant="quiet" size="lg" onClick={onCancel} />
        <div style={{ flex: 1 }}>
          <DenButton label={submitting ? 'Checking…' : "Let's go"} size="lg" full disabled={!password || submitting} onClick={() => void handleSubmit()} />
        </div>
      </div>

      <div style={{ marginTop: 20, fontSize: 13, color: 'var(--fg-tertiary)', textAlign: 'center' }}>
        Forgot it? A grown-up can type the admin password here instead.
      </div>
    </CardShell>
  )
}
