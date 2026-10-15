import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { words } from './writing_fixtures.test.lib.ts'
import { WritingSurface } from './writing_surface.pure.ui.tsx'

const meta = {
  title: 'app/writing/WritingSurface',
  component: WritingSurface,
  args: { briefTitle: 'Your forge', briefBody: 'A talking crow, the last night bus, a chewed-up map.', briefChips: ['a talking crow', 'the last night bus'], value: words(130), onChange: fn(), onPolish: fn() },
} satisfies Meta<typeof WritingSurface>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const JustStarted: Story = { args: { value: 'Once upon a' } }
