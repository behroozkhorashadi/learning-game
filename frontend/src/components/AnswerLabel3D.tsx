import { Html } from '@react-three/drei'

/**
 * Floating answer-number label anchored above a zombie's head, using drei's
 * `Html` helper — this renders real DOM (not a canvas texture), so it stays
 * crisp, upright, and never mirrors regardless of camera angle, and is a
 * genuine accessible DOM node (not just pixels inside the canvas).
 */
interface Props {
  value: number
  color: string
  /** True once this carrier is defeated — fades the label out rather than
   * leaving a number floating over an empty spot. */
  hidden?: boolean
}

export function AnswerLabel3D({ value, color, hidden }: Props) {
  if (hidden) return null
  return (
    <Html center distanceFactor={6} zIndexRange={[10, 0]} occlude={false} pointerEvents="none">
      <div
        aria-hidden="true"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          minWidth: 44,
          height: 44,
          padding: '0 12px',
          borderRadius: 9999,
          background: '#FFFFFF',
          border: `3px solid ${color}`,
          fontFamily: 'var(--font-display)',
          fontWeight: 800,
          fontSize: 22,
          color: '#2A2E37',
          boxShadow: '0 4px 10px rgba(0,13,51,0.35)',
          whiteSpace: 'nowrap',
        }}
      >
        {value}
      </div>
    </Html>
  )
}
