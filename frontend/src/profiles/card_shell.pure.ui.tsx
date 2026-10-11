import type { ReactElement, ReactNode } from 'react'

/** The centred card the unlock, edit, and admin screens sit in. */
export function CardShell({ children }: { readonly children: ReactNode }): ReactElement {
  return (
    <div style={{ minHeight: '100%', boxSizing: 'border-box', background: 'var(--surface-app)', display: 'flex', justifyContent: 'center', padding: '56px 24px' }}>
      <div style={{ width: '100%', maxWidth: 560, background: 'var(--surface-default)', border: '1px solid var(--border-subtle)', borderRadius: 32, padding: '44px 40px', boxShadow: 'var(--elevation-600)' }}>
        {children}
      </div>
    </div>
  )
}
