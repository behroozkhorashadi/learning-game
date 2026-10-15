import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState, type ReactElement } from 'react'
import { fn } from 'storybook/test'
import { picture } from '@app/profiles/profile_photo_fixtures.test.lib.ts'
import { fakePathfinderScreens } from './pathfinder_screens.test.ui.tsx'

interface BoundProps {
  readonly serverDown: boolean
  /** The art hung behind the game, or null for none. */
  readonly backdropUrl: string | null
  readonly onBack: () => void
}

/** The whole game over an in-memory server: a fresh profile, every screen bound to fakes. */
function Bound({ serverDown, backdropUrl, onBack }: BoundProps): ReactElement {
  const [{ Pathfinder }] = useState(() => {
    const screens = fakePathfinderScreens(undefined, backdropUrl)
    screens.server.failing = serverDown
    return screens
  })
  return <Pathfinder profileId={1} profileName="Mia" onBack={onBack} />
}

const meta = {
  title: 'app/pathfinder/Pathfinder',
  component: Bound,
  parameters: { layout: 'fullscreen' },
  args: { serverDown: false, backdropUrl: null, onBack: fn() },
} satisfies Meta<typeof Bound>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const ServerDown: Story = {
  args: { serverDown: true },
}

/** With the Pathfinder Backdrop: the art the kid hung in the Style Studio fills the page behind the board. */
export const WithBackdrop: Story = {
  args: { backdropUrl: picture('#9D57FA') },
}
