import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { ParentVerify } from './parent_verify.pure.ui.tsx'

const meta = {
  title: 'app/session/ParentVerify',
  component: ParentVerify,
  args: { word: 'rabbit', kidName: 'Mia', onResult: fn() },
} satisfies Meta<typeof ParentVerify>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    for (const digit of ['1', '2', '3', '4']) await userEvent.click(canvas.getByRole('button', { name: digit }))
    await userEvent.click(canvas.getByRole('button', { name: 'Correct' }))
    await expect(args.onResult).toHaveBeenCalledWith(true)
  },
}

export const WrongPin: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    for (const digit of ['9', '9', '9', '9']) await userEvent.click(canvas.getByRole('button', { name: digit }))
    await expect(canvas.getByText(/Wrong PIN/)).toBeVisible()
    await expect(await canvas.findByRole('img', { name: 'PIN digits entered: 0 of 4' })).toBeVisible()
  },
}
