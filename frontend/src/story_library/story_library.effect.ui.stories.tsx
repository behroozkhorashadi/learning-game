import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState, type ReactElement } from 'react'
import { fn } from 'storybook/test'
import { CROW, LIGHTHOUSE, fakePiecesStore } from './library_fixtures.test.lib.ts'
import { loadLibrary } from './library_loader.pure.lib.ts'
import { bindStoryLibrary } from './story_library.effect.ui.tsx'

/** The real bound screen over an in-memory pieces store; every delete is confirmed. */
function Bound(): ReactElement {
  const [StoryLibrary] = useState(() => {
    const store = fakePiecesStore([CROW, LIGHTHOUSE])
    return bindStoryLibrary({ loadLibrary: (id) => loadLibrary(store, id), removePiece: store.remove, confirm: () => true })
  })
  return <StoryLibrary profileId={1} profileName="Mia" onBack={fn()} onWriteNew={fn()} />
}

const meta = {
  title: 'app/story_library/StoryLibrary',
  component: Bound,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof Bound>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
