import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { LOADING, failed, loaded } from '@app/query/query_state.pure.lib.ts'
import { ArmoryShop } from './armory_shop.pure.ui.tsx'
import { fakeArmory } from './horde_fakes.test.ui.tsx'

const meta = {
  title: 'app/horde/ArmoryShop',
  component: ArmoryShop,
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 680, padding: 24, background: '#FFF6EA' }}>
        <Story />
      </div>
    ),
  ],
  args: {
    armory: loaded(fakeArmory({ balance: 320, owned: ['rapid_blaster'], grenades: 2, ammo: { armor_piercing: 14 } }).state()),
    choice: { weaponId: 'rapid_blaster', bulletId: 'standard_rounds' },
    onChoose: fn(),
    onBuy: fn(),
    buying: null,
    bought: null,
    buyError: null,
    skinId: 'steel_suit',
    onWear: fn(),
  },
} satisfies Meta<typeof ArmoryShop>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const JustBoughtGrenades: Story = {
  args: { bought: 'grenade_pack', armory: loaded(fakeArmory({ balance: 240, grenades: 5 }).state()) },
}

export const ArmorGems: Story = {
  args: { bought: 'reflect_gem', armory: loaded(fakeArmory({ balance: 200, gems: { reflect_gem: 4, mega_gem: 2 } }).state()) },
}

export const Broke: Story = {
  args: { armory: loaded(fakeArmory({ balance: 0, grenades: 0 }).state()) },
}

export const Loading: Story = {
  args: { armory: LOADING },
}

export const Failed: Story = {
  args: { armory: failed('GET /api/profiles/1/armory failed with HTTP 500') },
}
