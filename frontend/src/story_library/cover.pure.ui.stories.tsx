import type { Meta, StoryObj } from '@storybook/react-vite'
import { Cover } from './cover.pure.ui.tsx'
import { LIGHTHOUSE } from './library_fixtures.test.lib.ts'

const meta = {
  title: 'app/story_library/Cover',
  component: Cover,
  args: { piece: LIGHTHOUSE, illustrations: [], label: 'The Ninety-Six Steps' },
} satisfies Meta<typeof Cover>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
