import { useState, type ReactElement } from 'react'
import { DenButton } from './den_button.pure.ui.tsx'
import type { GameVolume } from './game_volume.pure.lib.ts'

interface GameVolumeControlProps {
  readonly volume: GameVolume
  readonly onChange: (volume: GameVolume) => void
}

const MUTED_ICON = ['M4.75 9.75H8L13.25 5V19L8 14.25H4.75V9.75Z', 'M17 8.5L21 15.5M21 8.5L17 15.5']
const LOW_ICON = ['M4.75 9.75H8L13.25 5V19L8 14.25H4.75V9.75Z', 'M17 9C17.8 9.7 18.25 10.8 18.25 12C18.25 13.2 17.8 14.3 17 15']
const HIGH_ICON = [...LOW_ICON, 'M19 6.75C20.4 8.1 21.25 9.9 21.25 12C21.25 14.1 20.4 15.9 19 17.25']

const LABELS: Record<GameVolume, string> = {
  0: 'muted',
  0.5: 'low',
  1: 'high',
}

const OPTIONS: readonly { readonly volume: GameVolume; readonly label: string }[] = [
  { volume: 1, label: 'High' },
  { volume: 0.5, label: 'Low' },
  { volume: 0, label: 'Muted' },
]

export function GameVolumeControl({ volume, onChange }: GameVolumeControlProps): ReactElement {
  const [open, setOpen] = useState(false)
  const icon = volume === 0 ? MUTED_ICON : volume === 0.5 ? LOW_ICON : HIGH_ICON
  const label = `Volume ${LABELS[volume]}. Choose volume`
  return (
    <div style={{ position: 'relative', display: 'inline-flex' }}>
      <DenButton
        label={label}
        titleText={label}
        variant="quiet"
        shape="pill"
        size="md"
        iconOnly
        boxSize={44}
        onClick={() => {
          setOpen((wasOpen) => !wasOpen)
        }}
        iconPaths={icon}
      />
      {open && (
        <div
          role="group"
          aria-label="Volume options"
          style={{
            position: 'absolute',
            top: 'calc(100% + var(--space-2))',
            right: 0,
            display: 'flex',
            gap: 'var(--space-2)',
            padding: 'var(--space-2)',
            borderRadius: 'var(--radius-lg)',
            border: 'thin solid var(--border-default)',
            background: 'var(--surface-default)',
            boxShadow: 'var(--elevation-600)',
          }}
        >
          {OPTIONS.map((option) => {
            const selected = option.volume === volume
            return (
              <DenButton
                key={option.volume}
                label={option.label}
                ariaLabel={`${option.label} volume${selected ? ' (selected)' : ''}`}
                variant={selected ? 'softBlue' : 'quiet'}
                shape="pill"
                size="sm"
                onClick={() => {
                  onChange(option.volume)
                  setOpen(false)
                }}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

export type { GameVolumeControlProps }
