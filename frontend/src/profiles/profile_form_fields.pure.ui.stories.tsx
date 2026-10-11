import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
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

export const Filled: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('That makes them 7 years old.')).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Choose the owl avatar' }))
    await expect(args.onAvatarChange).toHaveBeenCalledWith('owl')
  },
}

export const Empty: Story = {
  args: { name: '', birthday: '', avatar: null },
}

export const BirthdayOutOfRange: Story = {
  args: { birthday: '2026-05-12' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('Please enter a valid birthday.')).toBeVisible()
  },
}
