import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { EMPTY_PASSWORD_DRAFT } from './profile_password.pure.lib.ts'
import { ProfilePasswordFields } from './profile_password_fields.pure.ui.tsx'

const meta = {
  title: 'app/profiles/ProfilePasswordFields',
  component: ProfilePasswordFields,
  args: { draft: EMPTY_PASSWORD_DRAFT, onChange: fn() },
} satisfies Meta<typeof ProfilePasswordFields>

export default meta
type Story = StoryObj<typeof meta>

export const NewPlayer: Story = {
  play: async ({ args, canvasElement }) => {
    await userEvent.type(within(canvasElement).getByLabelText('Password'), 't')
    await expect(args.onChange).toHaveBeenCalledWith({ password: 't', confirm: '', remove: false })
  },
}

export const Mismatch: Story = {
  args: { draft: { password: 'tiger', confirm: 'tige', remove: false } },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText("The two passwords don't match yet.")).toBeVisible()
  },
}

export const EditWithExistingPassword: Story = {
  args: { hasPassword: true },
  play: async ({ args, canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('checkbox', { name: /Remove the password/ }))
    await expect(args.onChange).toHaveBeenCalledWith({ password: '', confirm: '', remove: true })
  },
}
