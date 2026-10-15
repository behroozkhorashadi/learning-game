import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { loaded } from '@app/query/query_state.pure.lib.ts'
import { ArmoryShop } from './armory_shop.pure.ui.tsx'
import { fakeArmory } from './horde_fakes.test.ui.tsx'
import { HordeStart } from './horde_start.pure.ui.tsx'

const meta = {
  title: 'app/horde/HordeStart',
  component: HordeStart,
  args: {
    shop: <ArmoryShop armory={loaded(fakeArmory({ balance: 140 }).state())} choice={{ weaponId: 'starter_blaster', bulletId: 'standard_rounds' }} onChoose={fn()} onBuy={fn()} buying={null} bought={null} buyError={null} skinId="steel_suit" onWear={fn()} />,
    starting: false,
    difficulty: 'medium',
    onChooseDifficulty: fn(),
    bestMs: { easy: 0, medium: 84_000, hard: 0, insane: 0 },
    readingInstructions: false, onHearInstructions: fn(),
    onStart: fn(),
    onOpenStudio: fn(),
    onOpenStyle: fn(),
    onBack: fn(),
  },
} satisfies Meta<typeof HordeStart>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Starting: Story = {
  args: { starting: true },
}

export const Reading: Story = {
  args: { readingInstructions: true },
}
