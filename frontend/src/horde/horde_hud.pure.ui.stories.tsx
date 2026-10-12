import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { HordeHud } from './horde_hud.pure.ui.tsx'

const meta = {
  title: 'app/horde/HordeHud',
  component: HordeHud,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div style={{ position: 'relative', height: 480, background: '#6B5BA8', overflow: 'hidden' }}>
        <Story />
      </div>
    ),
  ],
  args: {
    question: '7 × 6 =',
    intro: false,
    secondsLeft: 37,
    lives: 2,
    grenades: 3,
    shoves: 3,
    ammo: null,
    armed: 'shot',
    muted: false,
    answers: [
      { zombieId: 'z1', label: '42' },
      { zombieId: 'z2', label: '36' },
      { zombieId: 'z3', label: '48' },
      { zombieId: 'z4', label: '49' },
    ],
    feedback: null,
    aimNdc: { x: 0.1, y: -0.1 },
    reducedMotion: false,
    onBack: fn(),
    onToggleGrenade: fn(),
    onPushBack: fn(),
    onToggleMute: fn(),
    onZap: fn(),
    flags: 1,
    onFlag: fn(),
  },
} satisfies Meta<typeof HordeHud>

export default meta
type Story = StoryObj<typeof meta>

export const Playing: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Zap the zombie carrying 42' }))
    await expect(args.onZap).toHaveBeenCalledWith('z1')
    await userEvent.click(canvas.getByRole('button', { name: 'Grenade (3 left)' }))
    await expect(args.onToggleGrenade).toHaveBeenCalled()
  },
}

export const GrenadeArmed: Story = {
  args: { armed: 'grenade' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('status')).toHaveTextContent('Grenade ready')
  },
}

export const Intro: Story = {
  args: { intro: true, answers: [] },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('heading', { name: 'Question' })).toHaveTextContent('7 × 6 =')
  },
}

export const Hurt: Story = {
  args: { feedback: { kind: 'hurt', id: 1 }, lives: 1, secondsLeft: 8 },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('img', { name: '1 lives left' })).toBeVisible()
  },
}
