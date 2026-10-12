import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
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
  },
} satisfies Meta<typeof ArmoryShop>

export default meta
type Story = StoryObj<typeof meta>

export const BuyAndEquip: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Buy Armor-Piercing Rounds for 60 points' }))
    await expect(args.onBuy).toHaveBeenCalledWith('armor_piercing')
    await userEvent.click(canvas.getByRole('button', { name: 'Equip Starter Blaster' }))
    await expect(args.onChoose).toHaveBeenCalledWith({ weaponId: 'starter_blaster', bulletId: 'standard_rounds' })
  },
}

export const JustBoughtGrenades: Story = {
  args: { bought: 'grenade_pack', armory: loaded(fakeArmory({ balance: 240, grenades: 5 }).state()) },
  play: async ({ canvasElement }) => {
    const grenades = within(within(canvasElement).getByRole('list', { name: 'Grenades' }))
    await expect(grenades.getByRole('status')).toHaveTextContent('Bought 3 grenades!')
    await expect(grenades.getByText('You have 5')).toBeVisible()
  },
}

export const Broke: Story = {
  args: { armory: loaded(fakeArmory({ balance: 0, grenades: 0 }).state()) },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('status', { name: 'Points' })).toHaveTextContent('0 points')
  },
}

export const Loading: Story = {
  args: { armory: LOADING },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('Opening the armory…')).toBeVisible()
  },
}

export const Failed: Story = {
  args: { armory: failed('GET /api/profiles/1/armory failed with HTTP 500') },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('alert')).toHaveTextContent('HTTP 500')
  },
}
