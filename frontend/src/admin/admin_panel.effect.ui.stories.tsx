import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState, type ReactElement } from 'react'
import { fn } from 'storybook/test'
import { fakeAdminPanel } from './admin_fixtures.test.ui.tsx'

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

export const Default: Story = {}
