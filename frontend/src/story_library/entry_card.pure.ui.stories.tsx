import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { loaded } from '@app/query/query_state.pure.lib.ts'
import { EntryCardView } from './entry_card.pure.ui.tsx'
import { CROW, LIGHTHOUSE } from './library_fixtures.test.lib.ts'

const meta = {
  title: 'app/story_library/EntryCardView',
  component: EntryCardView,
  args: { state: loaded({ pieces: [CROW, LIGHTHOUSE], illustrations: {} }), onOpen: fn() },
} satisfies Meta<typeof EntryCardView>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Empty: Story = {
  args: { state: loaded({ pieces: [], illustrations: {} }) },
}
