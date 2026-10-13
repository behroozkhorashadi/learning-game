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
    revealed: false,
    onDontKnow: fn(),
    intro: false,
    secondsLeft: 37,
    overtime: null,
    onEndOvertime: fn(),
    lives: 2,
    grenades: 3,
    shoves: 3,
    shoveEarned: false,
    ammo: null,
    outOfRounds: false,
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

export const OutOfRounds: Story = {
  args: { ammo: 0, outOfRounds: true },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(/Out of special rounds/)).toBeVisible()
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

export const OvertimeStarts: Story = {
  args: { secondsLeft: 0, overtime: { lastedMs: 60_800, bestMs: 84_000, clockMs: 60_000 } },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Overtime!', { exact: false })).toBeVisible()
    await expect(canvas.getByRole('status', { name: 'Your best: 1 minute 24 seconds' })).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Stop & bank points' }))
    await expect(args.onEndOvertime).toHaveBeenCalledTimes(1)
  },
}

export const NewRecord: Story = {
  args: { question: 'If x × 4 = 24, x =', secondsLeft: 0, overtime: { lastedMs: 91_000, bestMs: 84_000, clockMs: 60_000 } },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('status', { name: 'New personal best!' })).toHaveTextContent('New record!')
  },
}

export const AnswerRevealed: Story = {
  args: { question: '7 × 6 = 42', revealed: true, answers: [{ zombieId: 'z1', label: '42' }] },
  // Once the answer shows, there's nothing left to ask for.
  render: (args) => <HordeHud {...args} onDontKnow={null} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { name: 'Question' })).toHaveTextContent('7 × 6 = 42')
    await expect(canvas.queryByRole('button', { name: "I don't know" })).toBeNull()
  },
}

export const DontKnow: Story = {
  play: async ({ args, canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: "I don't know" }))
    await expect(args.onDontKnow).toHaveBeenCalledTimes(1)
  },
}

export const PushBackEarned: Story = {
  args: { shoves: 2, shoveEarned: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('✋ +1 push-back for 3 right answers!')).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Push back the closest zombie (2 left)' })).toBeEnabled()
  },
}
