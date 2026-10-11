import { useState, type ComponentType, type ReactElement } from 'react'
import { DenButton } from '@app/den/den_button.pure.ui.tsx'
import { CardShell } from '@app/profiles/card_shell.pure.ui.tsx'
import { errorMessage } from '@app/query/query_state.pure.lib.ts'

/** The admin screen's password gate (see backend/app/admin_auth.py: a UX nicety, not security). */

export interface AdminLoginProps {
  readonly onAuthenticated: (password: string) => void
  readonly onCancel: () => void
}

export interface AdminLoginDeps {
  /** POST /api/admin/login. In the app, the admin API adapter's `login`. */
  readonly login: (password: string) => Promise<'ok' | 'wrong-password'>
}

export function bindAdminLogin({ login }: AdminLoginDeps): ComponentType<AdminLoginProps> {
  function AdminLogin({ onAuthenticated, onCancel }: AdminLoginProps): ReactElement {
    const [password, setPassword] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    async function handleSubmit(): Promise<void> {
      if (submitting) return
      setSubmitting(true)
      setError(null)
      try {
        if ((await login(password)) === 'wrong-password') {
          setError('Incorrect password.')
          return
        }
        onAuthenticated(password)
      } catch (err) {
        setError(errorMessage(err))
      } finally {
        setSubmitting(false)
      }
    }

    return (
      <CardShell>
        <h1 style={{ margin: 0, fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 32, color: 'var(--fg-primary)', textAlign: 'center' }}>Admin</h1>
        <div style={{ marginTop: 8, fontSize: 16, color: 'var(--fg-tertiary)', textAlign: 'center' }}>Enter the admin password.</div>

        <input
          type="password"
          aria-label="Admin password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void handleSubmit()
          }}
          placeholder="Password"
          autoFocus
          style={{
            width: '100%',
            boxSizing: 'border-box',
            marginTop: 32,
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
          <div role="alert" style={{ marginTop: 20, color: '#CD2A20', background: '#FDF2F2', padding: 12, borderRadius: 12 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 12, marginTop: 32 }}>
          <DenButton label="Back" variant="quiet" size="lg" onClick={onCancel} />
          <div style={{ flex: 1 }}>
            <DenButton label={submitting ? 'Checking…' : 'Enter'} size="lg" full disabled={submitting} onClick={() => void handleSubmit()} />
          </div>
        </div>
      </CardShell>
    )
  }
  return AdminLogin
}
