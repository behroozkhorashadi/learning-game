import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState, type ReactElement } from 'react'
import { fn } from 'storybook/test'
import { SceneStoryFrame } from '@app/arena/scene_story_frame.test.ui.tsx'
import type { WornEmblem } from './blaster_finish.pure.lib.ts'
import { EquationBlaster } from './equation_blaster.pure.ui.tsx'
import { MEGA_BLASTER, RAPID_BLASTER, STARTER_BLASTER, type WeaponDefinition } from './weapon_definitions.pure.lib.ts'

/** The first-person blaster on its own, with a Fire button that bumps the recoil signal. */
type Tint = { readonly color: string; readonly amount: number; readonly glow: number } | null

function Stage({ onReloadStart, weapon = STARTER_BLASTER, armTint = null, blasterTint = null, emblem = null }: { readonly onReloadStart: () => void; readonly weapon?: WeaponDefinition; readonly armTint?: Tint; readonly blasterTint?: Tint; readonly emblem?: WornEmblem | null }): ReactElement {
  const [shots, setShots] = useState(0)
  return (
    <div>
      <button
        type="button"
        onClick={() => {
          setShots((n) => n + 1)
        }}
      >
        Fire
      </button>
      <span role="status">{`${String(shots)} fired`}</span>
      <SceneStoryFrame>
        <EquationBlaster
          weapon={weapon}
          armTint={armTint}
          blasterTint={blasterTint}
          emblem={emblem}
          weaponPhase="readyFirstShot"
          cockingUntilMs={null}
          elapsedMs={0}
          cockingMs={weapon.cockingMs}
          recoilSignal={shots}
          aimNdc={{ x: 0.2, y: 0.1 }}
          reducedMotion={false}
          onReloadStart={onReloadStart}
        />
      </SceneStoryFrame>
    </div>
  )
}

const meta = {
  // Real WebGL: look at it in Storybook (`npm run storybook`); too heavy to run as a test.
  tags: ['!test'], title: 'app/blaster/EquationBlaster', component: Stage, args: { onReloadStart: fn() } } satisfies Meta<typeof Stage>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

/** The Rapid Blaster: cyan rails, a scope, a cyan flash. */
export const Rapid: Story = { args: { weapon: RAPID_BLASTER }, }

/** The Mega Blaster: glowing rings, gold power cores, a big pink flash. */
export const Mega: Story = { args: { weapon: MEGA_BLASTER }, }

/** Zombie Horde's Gold Suit armor skin: both arms tinted gold, with a soft glow. */
export const GoldArmorArms: Story = { args: { armTint: { color: '#D4A017', amount: 0.6, glow: 0.3 } }, }

const STAR_BADGE = `data:image/svg+xml;charset=utf-8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><circle cx="64" cy="64" r="64" fill="#FFAA00"/><text x="64" y="68" font-size="76" text-anchor="middle" dominant-baseline="middle">⭐</text></svg>')}`

/** Zombie Horde's Style Studio: pink glowing suit paint, a mint blaster, and a star emblem on the arm and the blaster. */
export const PaintedWithEmblem: Story = {
  args: {
    armTint: { color: '#FF3FA4', amount: 0.55, glow: 0.6 },
    blasterTint: { color: '#2EE6A8', amount: 0.7, glow: 0.12 },
    emblem: { imageUrl: STAR_BADGE, ringColor: '#FFAA00', onArm: true, onBlaster: true },
  },
}
