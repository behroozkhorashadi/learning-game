import type { Meta, StoryObj } from '@storybook/react-vite'
import { DenCard } from './den_card.pure.ui.tsx'

const meta = {
  title: 'app/den/DenCard',
  component: DenCard,
  args: { kicker: 'Round 2', title: 'Zombie wave', meta: '3/5', footerNote: 'Keep going!', children: 'Solve the equation on each zombie.' },
} satisfies Meta<typeof DenCard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Warm: Story = { args: { tone: 'warm', shadow: 'soft' } }

export const BodyOnly: Story = { args: { kicker: '', title: '', meta: '', footerNote: '' } }
