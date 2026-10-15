import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { ProfileFormFields } from './profile_form_fields.pure.ui.tsx'

const meta = {
  title: 'app/profiles/ProfileFormFields',
  component: ProfileFormFields,
  args: {
    today: '2026-10-10',
    name: 'Nora',
    onNameChange: fn(),
    birthday: '2019-05-12',
    onBirthdayChange: fn(),
    avatar: 'cat',
    onAvatarChange: fn(),
    readingSupport: false,
    onReadingSupportChange: fn(),
  },
} satisfies Meta<typeof ProfileFormFields>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Empty: Story = {
  args: { name: '', birthday: '', avatar: null },
}

export const BirthdayOutOfRange: Story = {
  args: { birthday: '2026-05-12' },
}
