import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { EMPTY_PASSWORD_DRAFT } from './profile_password.pure.lib.ts'
import { ProfilePasswordFields } from './profile_password_fields.pure.ui.tsx'

const meta = {
  title: 'app/profiles/ProfilePasswordFields',
  component: ProfilePasswordFields,
  args: { draft: EMPTY_PASSWORD_DRAFT, onChange: fn() },
} satisfies Meta<typeof ProfilePasswordFields>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Mismatch: Story = {
  args: { draft: { password: 'tiger', confirm: 'tige', remove: false } },
}

export const EditWithExistingPassword: Story = {
  args: { hasPassword: true },
}
