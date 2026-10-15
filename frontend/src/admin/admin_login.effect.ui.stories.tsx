import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState, type ReactElement } from 'react'
import { fn } from 'storybook/test'
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

export const Default: Story = {}
