import type { ReactElement, ReactNode } from 'react'
import { DenButton } from '@app/den/den_button.pure.ui.tsx'

/**
 * Zombie Horde's start screen: what the game is, how to play (read aloud on
 * request), the armory (passed in as `shop`), and Start. Props only.
 */

export const HORDE_TITLE = 'Zombie Horde'
export const HORDE_INSTRUCTIONS =
  'A math question shows up and four zombies wander toward you, each carrying an answer. Shoot the zombie with the right answer! Headshots do the most damage, and leg shots knock zombies down. Shoot a wrong one and it dodges and throws something back at you. Hold them off for 60 seconds. Points you earn buy better blasters, rounds, and grenades.'

const BACK_ICON = ['M10.25 6.75L4.75 12L10.25 17.25M19.25 12H5']
const SPEAKER_ICON = [
  'M15.75 10.75C15.75 10.75 16.25 11.234 16.25 12C16.25 12.766 15.75 13.25 15.75 13.25M17.75 7.75C17.75 7.75 19.25 9 19.25 11.999C19.25 14.997 17.75 16.25 17.75 16.25M13.25 4.75L8.5 8.75H5.75C5.48478 8.75 5.23043 8.85536 5.04289 9.04289C4.85536 9.23043 4.75 9.48478 4.75 9.75V14.25C4.75 14.5152 4.85536 14.7696 5.04289 14.9571C5.23043 15.1446 5.48478 15.25 5.75 15.25H8.5L13.25 19.25V4.75Z',
]
const PLAY_ICON = [{ d: 'M7.75 5.5L18.25 12L7.75 18.5V5.5Z', fill: '#FFFFFF' }]

export interface HordeStartProps {
  readonly shop: ReactNode
  /** Starting is held while the first question loads. */
  readonly starting: boolean
  readonly onHearInstructions: () => void
  readonly onStart: () => void
  /** Opens the art studio, or null while it can't be opened (the armory hasn't loaded). */
  readonly onOpenStudio: (() => void) | null
  readonly onBack: () => void
}

export function HordeStart({ shop, starting, onHearInstructions, onStart, onOpenStudio, onBack }: HordeStartProps): ReactElement {
  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: 760, background: '#FFF6EA', border: '1px solid #F1ECE0', borderRadius: 32, padding: '40px 32px 36px', boxShadow: '0 22px 44px -16px rgba(0,13,51,0.14)', textAlign: 'center', boxSizing: 'border-box' }}>
      <div style={{ position: 'absolute', top: 22, left: 22 }}>
        <DenButton label="Back" variant="quiet" shape="pill" size="md" iconOnly iconPaths={BACK_ICON} onClick={onBack} />
      </div>
      <div style={{ fontSize: 64, lineHeight: 1 }} aria-hidden="true">
        🧟
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.09em', textTransform: 'uppercase', fontWeight: 700, color: '#98A2B3', margin: '14px 0 8px' }}>60-second survival</div>
      <h1 style={{ margin: 0, fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 44, lineHeight: 1.04, color: '#2A2E37' }}>{HORDE_TITLE}</h1>
      <p style={{ margin: '12px auto 22px', fontSize: 17, lineHeight: '24px', color: '#8896AA', maxWidth: 560 }}>{HORDE_INSTRUCTIONS}</p>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 28 }}>
        <DenButton label="Hear how to play" variant="softBlue" shape="pill" size="xl" iconOnly iconPaths={SPEAKER_ICON} onClick={onHearInstructions} />
        <DenButton label={starting ? 'Loading…' : 'Start'} variant="blue" shape="pill" size="xl" lipColor="#0037DB" iconPaths={PLAY_ICON} disabled={starting} onClick={onStart} />
      </div>
      {shop}
      <div style={{ marginTop: 18, padding: '16px 18px', borderRadius: 20, background: '#F3ECFF', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, textAlign: 'left' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18, color: '#2A2E37' }}>🎨 Art Studio</div>
          <div style={{ fontSize: 13, color: '#5B6576' }}>Spend points to turn a selfie into zombie-slayer art.</div>
        </div>
        <DenButton label="Open studio" variant="softBlue" shape="pill" disabled={onOpenStudio === null} {...(onOpenStudio === null ? {} : { onClick: onOpenStudio })} />
      </div>
    </div>
  )
}
