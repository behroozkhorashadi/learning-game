import { useState, type CSSProperties, type ComponentType, type ReactElement } from 'react'
import type { ParentRecord } from '@app/api/parents_schema.pure.lib.ts'
import { DenButton } from '@app/den/den_button.pure.ui.tsx'
import { CardShell } from '@app/profiles/card_shell.pure.ui.tsx'
import { errorMessage } from '@app/query/query_state.pure.lib.ts'
import { createParentProblem, parentCreateFrom, type ParentCreateBody } from './create_parent_draft.pure.lib.ts'

/**
 * The "I'm a parent" screen: a grown-up's name and a password (required: it
 * guards the kids' progress). Kids link to a parent from their own profile.
 */

export interface CreateParentProps {
  /** The new parent and the password they set: the shell signs them straight in. */
  readonly onCreated: (parent: ParentRecord, password: string) => void
  readonly onCancel: () => void
}

export interface CreateParentDeps {
  /** POST /api/parents. */
  readonly createParent: (body: ParentCreateBody) => Promise<ParentRecord>
}

const inputStyle: CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '14px 16px', fontSize: 16, borderRadius: 14, border: '2px solid var(--border-default)', background: 'var(--surface-subtle)', color: 'var(--fg-primary)', outline: 'none' }
const labelStyle: CSSProperties = { display: 'block', marginBottom: 8, fontWeight: 700, color: 'var(--fg-secondary)' }

export function bindCreateParent({ createParent }: CreateParentDeps): ComponentType<CreateParentProps> {
  function CreateParent({ onCreated, onCancel }: CreateParentProps): ReactElement {
    const [name, setName] = useState('')
    const [password, setPassword] = useState('')
    const [confirm, setConfirm] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const draft = { name, password, confirm }
    const body = parentCreateFrom(draft)
    const problem = createParentProblem(draft)
    const touched = name !== '' || password !== '' || confirm !== ''

    async function handleSubmit(): Promise<void> {
      if (body === null || submitting) return
      setSubmitting(true)
      setError(null)
      try {
        onCreated(await createParent(body), body.password)
      } catch (err) {
        setError(errorMessage(err))
      } finally {
        setSubmitting(false)
      }
    }

    return (
      <CardShell>
        <h1 style={{ margin: 0, fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 32, color: 'var(--fg-primary)', textAlign: 'center' }}>I&apos;m a parent</h1>
        <p style={{ margin: '8px 0 0', fontSize: 16, color: 'var(--fg-tertiary)', textAlign: 'center', lineHeight: 1.5 }}>
          Make a parent account to see how your kids are doing: what they play, what they miss, and how they’re improving.
        </p>
        <label style={{ display: 'block', marginTop: 28 }}>
          <span style={labelStyle}>Your name</span>
          <input type="text" value={name} placeholder="Mom, Dad, Grandma…" onChange={(e) => { setName(e.target.value) }} style={inputStyle} />
        </label>
        <label style={{ display: 'block', marginTop: 20 }}>
          <span style={labelStyle}>Password</span>
          <input type="password" autoComplete="new-password" value={password} onChange={(e) => { setPassword(e.target.value) }} style={inputStyle} />
        </label>
        <label style={{ display: 'block', marginTop: 20 }}>
          <span style={labelStyle}>Password again</span>
          <input type="password" autoComplete="new-password" value={confirm} onChange={(e) => { setConfirm(e.target.value) }} style={inputStyle} />
        </label>
        <p style={{ margin: '12px 0 0', fontSize: 14, color: touched && problem !== null ? '#B42318' : 'var(--fg-tertiary)' }}>
          {touched && problem !== null ? problem : 'Kids can’t see the dashboard without it. Afterwards, link each kid from their profile.'}
        </p>
        {error !== null && (
          <div role="alert" style={{ marginTop: 16, color: '#CD2A20', background: '#FDF2F2', padding: 12, borderRadius: 12 }}>
            {error}
          </div>
        )}
        <div style={{ display: 'flex', gap: 12, marginTop: 28 }}>
          <DenButton label="Cancel" variant="quiet" size="lg" onClick={onCancel} />
          <div style={{ flex: 1 }}>
            <DenButton label={submitting ? 'Creating…' : 'Create parent account'} size="lg" full disabled={body === null || submitting} onClick={() => void handleSubmit()} />
          </div>
        </div>
      </CardShell>
    )
  }
  return CreateParent
}
