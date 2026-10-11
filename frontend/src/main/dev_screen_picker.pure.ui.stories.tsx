import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { DevScreenPicker } from './dev_screen_picker.pure.ui.tsx'

const meta = {
  title: 'app/main/DevScreenPicker',
  component: DevScreenPicker,
  args: {
    screen: 'index',
    screens: [
      { id: 'one', label: 'First screen', Screen: () => <h1>One</h1> },
      { id: 'two', label: 'Second screen', Screen: () => <h1>Two</h1> },
    ],
  },
} satisfies Meta<typeof DevScreenPicker>

export default meta
type Story = StoryObj<typeof meta>

export const List: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('link', { name: 'Second screen' })).toBeVisible()
  },
}

export const OneScreen: Story = { args: { screen: 'one' } }
