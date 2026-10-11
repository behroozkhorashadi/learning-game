import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState, type ReactElement } from 'react'
import { expect, fn, userEvent, within } from 'storybook/test'
import { ADMIN_PASSWORD, fakeAdminPanel } from './admin_fixtures.test.ui.tsx'

/** The real bound panel over an in-memory server. The admin password is "parentcode123". */
function Bound({ onClose }: { readonly onClose: () => void }): ReactElement {
  const [{ AdminPanel }] = useState(() => fakeAdminPanel())
  return <AdminPanel onClose={onClose} />
}

const meta = {
  title: 'app/admin/AdminPanel',
  component: Bound,
  parameters: { layout: 'fullscreen' },
  args: { onClose: fn() },
} satisfies Meta<typeof Bound>

export default meta
type Story = StoryObj<typeof meta>

export const LogInAndRemove: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.type(canvas.getByLabelText('Admin password'), `${ADMIN_PASSWORD}{Enter}`)
    await userEvent.click(await canvas.findByRole('button', { name: 'Delete Demo Kid' }))
    await userEvent.click(canvas.getByRole('button', { name: 'Yes, remove' }))
    await expect(await canvas.findByText('Rami')).toBeVisible()
    await expect(canvas.queryByText('Demo Kid')).toBeNull()
  },
}

export const WrongPassword: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.type(canvas.getByLabelText('Admin password'), 'nope{Enter}')
    await expect(await canvas.findByRole('alert')).toHaveTextContent('Incorrect password.')
  },
}
