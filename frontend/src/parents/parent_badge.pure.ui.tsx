import type { ReactElement } from 'react'

/** A grown-up's round initial badge: parents have no avatar, and this keeps them visibly apart from the kids. */
export function ParentBadge({ name, size }: { readonly name: string; readonly size: number }): ReactElement {
  return (
    <div
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        borderRadius: 9999,
        background: 'var(--paper-1600)',
        color: 'var(--paper-50)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--font-display)',
        fontWeight: 800,
        fontSize: Math.round(size * 0.42),
        flexShrink: 0,
      }}
    >
      {name.trim().charAt(0).toUpperCase() || '?'}
    </div>
  )
}
