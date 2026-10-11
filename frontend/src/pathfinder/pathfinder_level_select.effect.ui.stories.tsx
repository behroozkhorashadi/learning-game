import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState, type ReactElement } from 'react'
import { expect, fn, userEvent, within } from 'storybook/test'
import { fakePathfinderServer, squarePuzzle } from './pathfinder_fakes.test.lib.ts'
import { bindPathfinderLevelSelect } from './pathfinder_level_select.effect.ui.tsx'
import { ALL_LEVELS } from './pathfinder_levels.pure.lib.ts'
import { computeLevelStatuses } from './pathfinder_progress.pure.lib.ts'

/** The real bound level map over an in-memory library holding one saved map; the first two levels are done. */
function Bound({ onSelect }: { readonly onSelect: (levelId: string) => void }): ReactElement {
  const [LevelSelect] = useState(() => {
    const server = fakePathfinderServer()
    server.seed(1, squarePuzzle('custom-1', 'Mine'))
    return bindPathfinderLevelSelect({ listMaps: server.listMaps })
  })
  const completed = new Set(ALL_LEVELS.slice(0, 2).map((l) => l.id))
  return <LevelSelect profileId={1} statuses={computeLevelStatuses(ALL_LEVELS, completed)} onSelect={onSelect} onBuild={fn()} onBrowsePublished={fn()} />
}

const meta = {
  title: 'app/pathfinder/PathfinderLevelSelect',
  component: Bound,
  args: { onSelect: fn() },
} satisfies Meta<typeof Bound>

export default meta
type Story = StoryObj<typeof meta>

export const PartlyDone: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText("1 map you've built")).toBeVisible()
    const third = ALL_LEVELS[2]
    if (third === undefined) return
    await userEvent.click(canvas.getByRole('button', { name: third.name ?? third.id }))
    await expect(args.onSelect).toHaveBeenCalledWith(third.id)
  },
}
