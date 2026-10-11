import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState, type ReactElement } from 'react'
import { expect, fn, userEvent, within } from 'storybook/test'
import { LOCKED } from './profile_fixtures.test.lib.ts'
import { bindProfileUnlock } from './profile_unlock.effect.ui.tsx'
import { fakeProfilesServer } from './profiles_api_fake.test.lib.ts'

/** The real bound prompt over a fake server whose password is "tiger42". */
function Bound({ onUnlocked }: { readonly onUnlocked: (password: string) => void }): ReactElement {
  const [ProfileUnlock] = useState(() => bindProfileUnlock({ unlockProfile: fakeProfilesServer({ profiles: [LOCKED] }).unlock }))
  return <ProfileUnlock profile={LOCKED} onUnlocked={onUnlocked} onCancel={fn()} />
}

const meta = {
  title: 'app/profiles/ProfileUnlock',
  component: Bound,
  parameters: { layout: 'fullscreen' },
  args: { onUnlocked: fn() },
} satisfies Meta<typeof Bound>

export default meta
type Story = StoryObj<typeof meta>

export const Unlocks: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.type(canvas.getByLabelText('Password'), 'tiger42{Enter}')
    await expect(args.onUnlocked).toHaveBeenCalledWith('tiger42')
  },
}

export const WrongPassword: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.type(canvas.getByLabelText('Password'), 'nope{Enter}')
    await expect(await canvas.findByRole('alert')).toHaveTextContent("That's not it. Try again!")
    await expect(args.onUnlocked).not.toHaveBeenCalled()
  },
}
