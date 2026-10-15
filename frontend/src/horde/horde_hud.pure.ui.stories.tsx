import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
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
    revealedAnswer: null,
    onDontKnow: fn(),
    intro: false,
    secondsLeft: 37,
    overtime: null,
    onEndOvertime: fn(),
    lives: 2,
    armor: { reflect: 0, block: 0, mega: 0, heal: 0 },
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
    streak: 0,
    armorColor: '#5CA8E6',
  },
} satisfies Meta<typeof HordeHud>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const GrenadeArmed: Story = {
  args: { armed: 'grenade' },
}

export const OutOfRounds: Story = {
  args: { ammo: 0, outOfRounds: true },
}

export const Intro: Story = {
  args: { intro: true, answers: [] },
}

export const Hurt: Story = {
  args: { feedback: { kind: 'hurt', id: 1 }, lives: 1, secondsLeft: 8 },
}

/** Gems on the armor, and half a heart gone to a blocked zombie. */
export const Armored: Story = {
  args: { armor: { reflect: 3, block: 1, mega: 2, heal: 2 }, streak: 3, lives: 2.5, armorColor: '#FFB020', feedback: { kind: 'block', id: 1 } },
}

export const OvertimeStarts: Story = {
  args: { secondsLeft: 0, overtime: { lastedMs: 60_800, bestMs: 84_000, clockMs: 60_000 } },
}

export const NewRecord: Story = {
  args: { question: 'If x × 4 = 24, x =', secondsLeft: 0, overtime: { lastedMs: 91_000, bestMs: 84_000, clockMs: 60_000 } },
}

export const AnswerRevealed: Story = {
  args: { revealedAnswer: '7 × 6 = 42', answers: [{ zombieId: 'z1', label: '42' }] },
  // Once the answer shows, there's nothing left to ask for.
  render: (args) => <HordeHud {...args} onDontKnow={null} />,
}

export const PushBackEarned: Story = {
  args: { shoves: 2, shoveEarned: true },
}
