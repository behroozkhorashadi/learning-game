import type { CSSProperties, ReactElement } from 'react'
import { partLabel, type EquationPart, type EquationPayload } from './equation_item.pure.lib.ts'

const TOKEN: CSSProperties = { fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 40, color: 'var(--fg-primary)' }

function Blank(): ReactElement {
  return (
    <span
      aria-label="missing"
      role="img"
      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 64, height: 64, borderRadius: 16, border: '2px dashed var(--border-tray)', background: 'var(--surface-subtle)', color: 'var(--fg-disabled)', fontSize: 30 }}
    >
      ?
    </span>
  )
}

/** The equation with its missing part as a blank. */
export function EquationDisplay({ payload }: { readonly payload: EquationPayload }): ReactElement {
  const token = (part: EquationPart): ReactElement => (payload.missing === part ? <Blank /> : <span style={TOKEN}>{partLabel(payload, part)}</span>)
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18, flexWrap: 'wrap' }}>
      {token('left')}
      {token('operator')}
      {token('right')}
      <span style={TOKEN}>=</span>
      {token('answer')}
    </div>
  )
}
