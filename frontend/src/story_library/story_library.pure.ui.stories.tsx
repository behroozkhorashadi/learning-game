import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { LOADING, failed, loaded } from '@app/query/query_state.pure.lib.ts'
import { CROW, LIGHTHOUSE, library } from './library_fixtures.test.lib.ts'
import { StoryLibraryView } from './story_library.pure.ui.tsx'

const meta = {
  title: 'app/story_library/StoryLibraryView',
  component: StoryLibraryView,
  parameters: { layout: 'fullscreen' },
  args: { state: loaded(library([CROW, LIGHTHOUSE])), profileName: 'Mia', error: null, onBack: fn(), onWriteNew: fn(), onDelete: fn() },
} satisfies Meta<typeof StoryLibraryView>

export default meta
type Story = StoryObj<typeof meta>

export const ShelfThenReader: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'The Crow' }))
    await expect(canvas.getByText('A crow found a map.')).toBeVisible()
  },
}

export const Empty: Story = {
  args: { state: loaded(library([])) },
  play: async ({ args, canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Write the first one' }))
    await expect(args.onWriteNew).toHaveBeenCalled()
  },
}

export const Loading: Story = { args: { state: LOADING } }

export const Failed: Story = {
  args: { state: failed('GET /api/pieces failed with HTTP 500') },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('alert')).toBeVisible()
  },
}
