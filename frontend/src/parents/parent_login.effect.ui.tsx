import { useState, type ComponentType, type ReactElement } from 'react'
import type { ParentRecord } from '@app/api/parents_schema.pure.lib.ts'
import { DenButton } from '@app/den/den_button.pure.ui.tsx'
import { CardShell } from '@app/profiles/card_shell.pure.ui.tsx'
import { errorMessage } from '@app/query/query_state.pure.lib.ts'
import { ParentBadge } from './parent_badge.pure.ui.tsx'

/**
 * The parent sign-in: their password (or the admin password as an
 * override). The accepted password is handed back so the dashboard can send
 * it on every read.
 */

export interface ParentLoginProps {
  readonly parent: ParentRecord
  readonly onSignedIn: (password: string) => void
  readonly onCancel: () => void
}

export interface ParentLoginDeps {
  /** POST /api/parents/{id}/unlock. */
  readonly unlockParent: (id: number, password: string) => Promise<'unlocked' | 'wrong-password'>
}

export function bindParentLogin({ unlockParent }: ParentLoginDeps): ComponentType<ParentLoginProps> {
  function ParentLogin({ parent, onSignedIn, onCancel }: ParentLoginProps): ReactElement {
    const [password, setPassword] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    async function handleSubmit(): Promise<void> {
      if (password === '' || submitting) return
      setSubmitting(true)
      setError(null)
      try {
        if ((await unlockParent(parent.id, password)) === 'wrong-password') {
          setError('That password didn’t work.')
          setPassword('')
          return
        }
        onSignedIn(password)
      } catch (err) {
        setError(errorMessage(err))
      } finally {
        setSubmitting(false)
      }
    }

    return (
      <CardShell>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <ParentBadge name={parent.name} size={96} />
        </div>
        <h1 style={{ margin: '20px 0 0', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 30, color: 'var(--fg-primary)', textAlign: 'center' }}>Parent sign-in</h1>
        <div style={{ marginTop: 8, fontSize: 16, color: 'var(--fg-tertiary)', textAlign: 'center' }}>Hi {parent.name}. Enter your password to see your kids’ progress.</div>
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
          style={{ width: '100%', boxSizing: 'border-box', marginTop: 28, padding: '14px 16px', fontSize: 16, borderRadius: 14, border: '2px solid var(--border-default)', background: 'var(--surface-subtle)', color: 'var(--fg-primary)', outline: 'none' }}
        />
        {error !== null && (
          <div role="alert" style={{ marginTop: 16, color: '#CD2A20', background: '#FDF2F2', padding: 12, borderRadius: 12 }}>
            {error}
          </div>
        )}
        <div style={{ display: 'flex', gap: 12, marginTop: 28 }}>
          <DenButton label="Cancel" variant="quiet" size="lg" onClick={onCancel} />
          <div style={{ flex: 1 }}>
            <DenButton label={submitting ? 'Checking…' : 'Sign in'} size="lg" full disabled={password === '' || submitting} onClick={() => void handleSubmit()} />
          </div>
        </div>
      </CardShell>
    )
  }
  return ParentLogin
}
