import type { CSSProperties, ReactElement } from 'react'
import { passwordDraftError, type PasswordDraft } from './profile_password.pure.lib.ts'

/** The optional password section of the create and edit screens. Props only. */

const inputStyle: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '14px 16px',
  fontSize: 16,
  borderRadius: 14,
  border: '2px solid var(--border-default)',
  background: 'var(--surface-subtle)',
  color: 'var(--fg-primary)',
  outline: 'none',
}

export interface ProfilePasswordFieldsProps {
  readonly draft: PasswordDraft
  readonly onChange: (draft: PasswordDraft) => void
  /** Edit screen only: whether the profile already has a password. */
  readonly hasPassword?: boolean
}

export function ProfilePasswordFields({ draft, onChange, hasPassword = false }: ProfilePasswordFieldsProps): ReactElement {
  const error = draft.password !== '' || draft.confirm !== '' ? passwordDraftError(draft) : null
  const help = hasPassword
    ? 'This player has a password. Type a new one to change it, or leave these blank to keep it.'
    : 'Ask for a password when someone picks this player. Leave blank for no password.'

  return (
    <div style={{ marginTop: 24 }}>
      <span style={{ display: 'block', fontWeight: 700, color: 'var(--fg-secondary)' }}>
        Password
        <span style={{ marginLeft: 8, fontWeight: 400, fontSize: 14, color: 'var(--fg-tertiary)' }}>Optional</span>
      </span>
      <span style={{ display: 'block', margin: '4px 0 8px', fontSize: 14, color: 'var(--fg-tertiary)' }}>{help}</span>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, opacity: draft.remove ? 0.5 : 1 }}>
        <input
          type="password"
          aria-label={hasPassword ? 'New password' : 'Password'}
          placeholder={hasPassword ? 'New password' : 'Password'}
          autoComplete="new-password"
          value={draft.password}
          disabled={draft.remove}
          onChange={(e) => {
            onChange({ ...draft, password: e.target.value })
          }}
          style={inputStyle}
        />
        <input
          type="password"
          aria-label="Type the password again"
          placeholder="Type it again"
          autoComplete="new-password"
          value={draft.confirm}
          disabled={draft.remove}
          onChange={(e) => {
            onChange({ ...draft, confirm: e.target.value })
          }}
          style={inputStyle}
        />
      </div>
      {error !== null && <span style={{ display: 'block', marginTop: 8, fontSize: 14, color: '#CD2A20' }}>{error}</span>}

      {hasPassword && (
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={draft.remove}
            onChange={(e) => {
              onChange({ password: '', confirm: '', remove: e.target.checked })
            }}
            style={{ width: 20, height: 20 }}
          />
          <span style={{ color: 'var(--fg-secondary)' }}>Remove the password (anyone can pick this player)</span>
        </label>
      )}
    </div>
  )
}
