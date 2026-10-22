import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState, type ReactElement } from 'react'
import { bindApp } from './app.effect.ui.tsx'
import { STUB_SCREENS } from './app_stub_screens.test.ui.tsx'

/** The real router over stand-in screens: shows the navigation, not the screens. */
function Bound(): ReactElement {
  const [App] = useState(() => bindApp({ screens: STUB_SCREENS, engagement: { start: () => () => undefined }, Overlay: null }))
  return <App />
}

const meta = {
  title: 'app/main/AppShell',
  component: Bound,
} satisfies Meta<typeof Bound>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
