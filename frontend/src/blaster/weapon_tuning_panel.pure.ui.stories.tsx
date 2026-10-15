import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState, type ReactElement } from 'react'
import { fn } from 'storybook/test'
import { DEFAULT_WEAPON_VIEW, type WeaponViewConfig } from './blaster_config.pure.lib.ts'
import { WeaponTuningPanel } from './weapon_tuning_panel.pure.ui.tsx'

function Stage({ copyText }: { readonly copyText: (text: string) => Promise<void> }): ReactElement {
  const [view, setView] = useState<WeaponViewConfig>(DEFAULT_WEAPON_VIEW)
  const [hideRight, setHideRight] = useState(false)
  const [hideLeft, setHideLeft] = useState(false)
  return (
    <div style={{ position: 'relative', height: 640, background: '#333' }}>
      <WeaponTuningPanel value={view} onChange={setView} hideRightArm={hideRight} onHideRightArmChange={setHideRight} hideLeftArm={hideLeft} onHideLeftArmChange={setHideLeft} copyText={copyText} />
    </div>
  )
}

const meta = { title: 'app/blaster/WeaponTuningPanel', component: Stage, args: { copyText: fn(() => Promise.resolve()) } } satisfies Meta<typeof Stage>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
