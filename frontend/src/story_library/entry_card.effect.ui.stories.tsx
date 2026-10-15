import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState, type ReactElement } from 'react'
import { fn } from 'storybook/test'
import { bindStorybookEntryCard } from './entry_card.effect.ui.tsx'
import { CROW, fakePiecesStore } from './library_fixtures.test.lib.ts'
import { loadShelfPeek } from './library_loader.pure.lib.ts'

/** The real bound card over an in-memory pieces store. */
function Bound(): ReactElement {
  const [Card] = useState(() => {
    const store = fakePiecesStore([CROW])
    return bindStorybookEntryCard({ loadPeek: (id) => loadShelfPeek(store, id) })
  })
  return <Card profileId={1} onOpen={fn()} />
}

const meta = {
  title: 'app/story_library/StorybookEntryCard',
  component: Bound,
} satisfies Meta<typeof Bound>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
