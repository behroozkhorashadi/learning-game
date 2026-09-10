import type { WeaponPhase } from '../lib/zombieWaveEngine'

/**
 * Two playful "energy charge" indicators showing shots left this wave —
 * orbs, not realistic ammo. Purely a read of engine state
 * (`wave.shotsRemaining`/`wave.weaponPhase`); it never decides anything
 * itself. Deliberately separate from — and authoritative over — the two
 * green circles baked into the weapon's own GLB texture, which this never
 * touches.
 */

interface Props {
  shotsRemaining: number
  weaponPhase: WeaponPhase
  reducedMotion: boolean
}

function ChargeOrb({ filled }: { filled: boolean }) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: 20,
        height: 20,
        borderRadius: '50%',
        display: 'inline-block',
        background: filled ? 'radial-gradient(circle at 35% 30%, #EAFFFB, #35E0C8 55%, #0FA894 100%)' : 'rgba(255,255,255,0.18)',
        border: filled ? '1.5px solid #0FA894' : '1.5px solid rgba(255,255,255,0.35)',
        boxShadow: filled ? '0 0 10px 1px rgba(53,224,200,0.65)' : 'none',
      }}
    />
  )
}

export function ChargeHud({ shotsRemaining, weaponPhase, reducedMotion }: Props) {
  if (weaponPhase === 'cocking') {
    return (
      <div
        data-testid="charge-hud"
        data-charge-state="cocking"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          height: 32,
          padding: '0 12px',
          borderRadius: 9999,
          background: 'rgba(0,0,0,0.4)',
          color: '#FFF7D6',
          fontFamily: 'var(--font-display)',
          fontWeight: 800,
          fontSize: 12,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          animation: reducedMotion ? 'none' : 'chargeCockingPulse 900ms ease-in-out infinite',
        }}
      >
        Cocking…
      </div>
    )
  }

  return (
    <div
      data-testid="charge-hud"
      data-charge-state="shots"
      data-shots-remaining={shotsRemaining}
      style={{ display: 'flex', alignItems: 'center', gap: 6, height: 32, padding: '0 10px', borderRadius: 9999, background: 'rgba(0,0,0,0.35)' }}
    >
      <ChargeOrb filled={shotsRemaining >= 2} />
      <ChargeOrb filled={shotsRemaining >= 1} />
    </div>
  )
}
