import type { ReactElement } from 'react'
import type { ParentRecord } from '@app/api/parents_schema.pure.lib.ts'

/**
 * The kid profile's "Parent" dropdown: which grown-up can see this kid's
 * progress. Props only. With no parent accounts yet, it says where to make one.
 */

export interface ParentSelectProps {
  readonly parents: readonly ParentRecord[]
  readonly value: number | null
  readonly onChange: (parentId: number | null) => void
}

export function ParentSelect({ parents, value, onChange }: ParentSelectProps): ReactElement {
  return (
    <label style={{ display: 'block', marginTop: 24 }}>
      <span style={{ display: 'block', marginBottom: 8, fontWeight: 700, color: 'var(--fg-secondary)' }}>Parent</span>
      <select
        value={value === null ? '' : String(value)}
        disabled={parents.length === 0}
        onChange={(e) => {
          onChange(e.target.value === '' ? null : Number(e.target.value))
        }}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          padding: '14px 16px',
          fontSize: 16,
          borderRadius: 14,
          border: '2px solid var(--border-default)',
          background: 'var(--surface-subtle)',
          color: 'var(--fg-primary)',
        }}
      >
        <option value="">No parent linked</option>
        {parents.map((parent) => (
          <option key={parent.id} value={String(parent.id)}>
            {parent.name}
          </option>
        ))}
      </select>
      <span style={{ display: 'block', marginTop: 8, fontSize: 14, color: 'var(--fg-tertiary)' }}>
        {parents.length === 0 ? 'No parents yet. A grown-up can add one with “I’m a parent” on the first screen.' : 'They’ll see this player’s progress in their parent dashboard.'}
      </span>
    </label>
  )
}
