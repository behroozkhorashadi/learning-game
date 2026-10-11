import { Html } from '@react-three/drei'
import type { ReactElement } from 'react'

/**
 * The bubble over a roaming zombie: the answer it carries (when there is a
 * question) and its health bar. Real DOM through drei's `Html`, so it stays
 * crisp and upright from any angle and shrinks with distance like the zombie.
 * Purely visual (`aria-hidden`): the HUD's answer buttons are the accessible
 * targets.
 */
export interface HordeZombieLabelProps {
  readonly answer: string | null
  readonly color: string
  /** 0..1 */
  readonly health: number
}

export function HordeZombieLabel({ answer, color, health }: HordeZombieLabelProps): ReactElement {
  const barColor = health > 0.6 ? '#5BCC2D' : health > 0.3 ? '#F59E0B' : '#CD2A20'
  return (
    <Html zIndexRange={[10, 0]} occlude={false} pointerEvents="none" style={{ transform: 'translate(-50%, -100%)' }}>
      <div aria-hidden="true" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
        {answer !== null && (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: 48,
              height: 48,
              padding: '0 12px',
              borderRadius: 9999,
              background: '#FFFFFF',
              border: `4px solid ${color}`,
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: 26,
              color: '#2A2E37',
              boxShadow: '0 4px 10px rgba(0,13,51,0.35)',
              whiteSpace: 'nowrap',
            }}
          >
            {answer}
          </div>
        )}
        <div style={{ width: 64, height: 10, borderRadius: 9999, background: 'rgba(20,10,10,0.55)', border: '2px solid rgba(255,255,255,0.85)', overflow: 'hidden' }}>
          <div style={{ width: `${String(Math.round(health * 100))}%`, height: '100%', background: barColor, transition: 'width 200ms ease-out' }} />
        </div>
      </div>
    </Html>
  )
}
