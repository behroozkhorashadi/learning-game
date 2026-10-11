import { useState, type ComponentType, type ReactElement } from 'react'
import type { ProfileRecord } from '@app/api/profiles_schema.pure.lib.ts'
import { DenButton } from '@app/den/den_button.pure.ui.tsx'
import { errorMessage } from '@app/query/query_state.pure.lib.ts'
import { CardShell } from './card_shell.pure.ui.tsx'
import { ProfileAvatar } from './profile_avatar.pure.ui.tsx'

/**
 * Password prompt for a protected profile, shown when a kid picks it on the
 * picker or taps its edit pencil. The server also accepts the admin password
 * as an override (backend/app/services/profile_passwords.py). The accepted
 * password is handed back so the shell can send it on later edits.
 */

export interface ProfileUnlockProps {
  readonly profile: ProfileRecord
  readonly onUnlocked: (password: string) => void
  readonly onCancel: () => void
}

export interface ProfileUnlockDeps {
  /** POST /api/profiles/{id}/unlock. In the app, the profiles API adapter's `unlock`. */
  readonly unlockProfile: (id: number, password: string) => Promise<'unlocked' | 'wrong-password'>
}

export function bindProfileUnlock({ unlockProfile }: ProfileUnlockDeps): ComponentType<ProfileUnlockProps> {
  function ProfileUnlock({ profile, onUnlocked, onCancel }: ProfileUnlockProps): ReactElement {
    const [password, setPassword] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    async function handleSubmit(): Promise<void> {
      if (password === '' || submitting) return
      setSubmitting(true)
      setError(null)
      try {
        if ((await unlockProfile(profile.id, password)) === 'wrong-password') {
          setError("That's not it. Try again!")
          setPassword('')
          return
        }
        onUnlocked(password)
      } catch (err) {
        setError(errorMessage(err))
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
        <h1 style={{ margin: '20px 0 0', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 32, color: 'var(--fg-primary)', textAlign: 'center' }}>Hi {profile.name}!</h1>
        <div style={{ marginTop: 8, fontSize: 16, color: 'var(--fg-tertiary)', textAlign: 'center' }}>Type your password to keep going.</div>

        <input
          type="password"
          aria-label="Password"
          placeholder="Password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value)
          }}
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

        {error !== null && (
          <div role="alert" style={{ marginTop: 16, color: '#CD2A20', background: '#FDF2F2', padding: 12, borderRadius: 12 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 12, marginTop: 28 }}>
          <DenButton label="Back" variant="quiet" size="lg" onClick={onCancel} />
          <div style={{ flex: 1 }}>
            <DenButton label={submitting ? 'Checking…' : "Let's go"} size="lg" full disabled={password === '' || submitting} onClick={() => void handleSubmit()} />
          </div>
        </div>

        <div style={{ marginTop: 20, fontSize: 13, color: 'var(--fg-tertiary)', textAlign: 'center' }}>Forgot it? A grown-up can type the admin password here instead.</div>
      </CardShell>
    )
  }
  return ProfileUnlock
}
