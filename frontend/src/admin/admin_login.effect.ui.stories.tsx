import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState, type ReactElement } from 'react'
import { expect, fn, userEvent, within } from 'storybook/test'
import { bindAdminLogin } from './admin_login.effect.ui.tsx'

/** The bound gate over a fake login that accepts "secret". */
function Bound({ onAuthenticated }: { readonly onAuthenticated: (password: string) => void }): ReactElement {
  const [AdminLogin] = useState(() => bindAdminLogin({ login: (password) => Promise.resolve(password === 'secret' ? 'ok' : 'wrong-password') }))
  return <AdminLogin onAuthenticated={onAuthenticated} onCancel={fn()} />
}

const meta = {
  title: 'app/admin/AdminLogin',
  component: Bound,
  parameters: { layout: 'fullscreen' },
  args: { onAuthenticated: fn() },
} satisfies Meta<typeof Bound>

export default meta
type Story = StoryObj<typeof meta>

export const Accepts: Story = {
  play: async ({ args, canvasElement }) => {
    await userEvent.type(within(canvasElement).getByLabelText('Admin password'), 'secret{Enter}')
    await expect(args.onAuthenticated).toHaveBeenCalledWith('secret')
  },
}

export const Refuses: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.type(canvas.getByLabelText('Admin password'), 'nope{Enter}')
    await expect(await canvas.findByRole('alert')).toHaveTextContent('Incorrect password.')
  },
}
