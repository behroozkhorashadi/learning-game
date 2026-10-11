import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { words } from './writing_fixtures.test.lib.ts'
import { WritingSurface } from './writing_surface.pure.ui.tsx'

const meta = {
  title: 'app/writing/WritingSurface',
  component: WritingSurface,
  args: { briefTitle: 'Your forge', briefBody: 'A talking crow, the last night bus, a chewed-up map.', briefChips: ['a talking crow', 'the last night bus'], value: words(130), onChange: fn(), onPolish: fn() },
} satisfies Meta<typeof WritingSurface>

export default meta
type Story = StoryObj<typeof meta>

export const GoalMet: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Ready to polish →' }))
    await userEvent.click(canvas.getByRole('button', { name: 'Yes, polish it' }))
    await expect(args.onPolish).toHaveBeenCalled()
  },
}

export const JustStarted: Story = { args: { value: 'Once upon a' } }
