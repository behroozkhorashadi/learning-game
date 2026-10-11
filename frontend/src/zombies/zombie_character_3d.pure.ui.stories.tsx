import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, waitFor, within } from 'storybook/test'
import type { ReactElement } from 'react'
import { SceneStoryFrame } from '@app/arena/scene_story_frame.test.ui.tsx'
import { HOCKEY_ZOMBIE, SCIENTIST_ZOMBIE, type CharacterDefinition } from './character_definitions.pure.lib.ts'
import type { ZombieClipRole } from './zombie_animation_fallback.pure.lib.ts'
import { ZombieCharacter3D } from './zombie_character_3d.pure.ui.tsx'

function Stage({ character, clipRole }: { readonly character: CharacterDefinition; readonly clipRole: ZombieClipRole }): ReactElement {
  return (
    <SceneStoryFrame camera={[0, 1.4, 3.2]}>
      <ZombieCharacter3D character={character} clipRole={clipRole} />
    </SceneStoryFrame>
  )
}

const meta = {
  title: 'app/zombies/ZombieCharacter3D',
  component: Stage,
  args: { character: SCIENTIST_ZOMBIE, clipRole: 'approach' },
} satisfies Meta<typeof Stage>

export default meta
type Story = StoryObj<typeof meta>

async function sceneReady(canvasElement: HTMLElement): Promise<void> {
  const frame = within(canvasElement).getByRole('figure', { name: '3D scene' })
  await waitFor(
    async () => {
      await expect(frame.dataset['sceneReady']).toBe('true')
    },
    { timeout: 10000 },
  )
}

export const Approaching: Story = {
  play: async ({ canvasElement }) => {
    await sceneReady(canvasElement)
  },
}

export const Reaching: Story = { args: { clipRole: 'reach' } }

export const HockeyDefeated: Story = { args: { character: HOCKEY_ZOMBIE, clipRole: 'deadHeadshot' } }
