import { useState, type ReactNode } from 'react'
import { DenButton } from './den/DenButton'

// The admin screen's password gate (see `backend/app/admin_auth.py`), plus the
// card layout shared with the profile edit/unlock screens.

export function CardShell({ children }: { children: ReactNode }) {
  return (
    <div style={{ minHeight: '100%', boxSizing: 'border-box', background: 'var(--surface-app)', display: 'flex', justifyContent: 'center', padding: '56px 24px' }}>
      <div style={{ width: '100%', maxWidth: 560, background: 'var(--surface-default)', border: '1px solid var(--border-subtle)', borderRadius: 32, padding: '44px 40px', boxShadow: 'var(--elevation-600)' }}>
        {children}
      </div>
    </div>
  )
}

export function LoginForm({ onAuthenticated, onCancel }: { onAuthenticated: (password: string) => void; onCancel: () => void }) {
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (res.status === 401) {
        setError('Incorrect password.')
        return
      }
      if (!res.ok) throw new Error(`POST /api/admin/login -> ${res.status}`)
      onAuthenticated(password)
    } catch (err) {
      setError(String(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <CardShell>
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 32, color: 'var(--fg-primary)', textAlign: 'center' }}>Admin</div>
      <div style={{ marginTop: 8, fontSize: 16, color: 'var(--fg-tertiary)', textAlign: 'center' }}>Enter the admin password. Leave it blank if none is set.</div>

      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !submitting) handleSubmit()
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

      {error && <div style={{ marginTop: 20, color: '#CD2A20', background: '#FDF2F2', padding: 12, borderRadius: 12 }}>{error}</div>}

      <div style={{ display: 'flex', gap: 12, marginTop: 32 }}>
        <DenButton label="Back" variant="quiet" size="lg" onClick={onCancel} />
        <div style={{ flex: 1 }}>
          <DenButton label={submitting ? 'Checking…' : 'Enter'} size="lg" full disabled={submitting} onClick={handleSubmit} />
        </div>
      </div>
    </CardShell>
  )
}
