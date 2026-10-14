import type { Meta, StoryObj } from '@storybook/react-vite'
import type { ReactElement } from 'react'
import { expect, waitFor, within } from 'storybook/test'
import { SceneStoryFrame } from '@app/arena/scene_story_frame.test.ui.tsx'
import { EmblemBadge } from './emblem_badge.pure.ui.tsx'

const ROCKET = `data:image/svg+xml;charset=utf-8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><circle cx="64" cy="64" r="64" fill="#5B3FD6"/><text x="64" y="68" font-size="76" text-anchor="middle" dominant-baseline="middle">🚀</text></svg>')}`

/** One emblem, big, facing the camera. */
function Stage({ imageUrl, ringColor }: { readonly imageUrl: string; readonly ringColor: string }): ReactElement {
  return (
    <SceneStoryFrame>
      <ambientLight intensity={1} />
      <group position={[0, 0, -2]}>
        <EmblemBadge imageUrl={imageUrl} ringColor={ringColor} spot={{ faces: [{ position: [0, 0, 0.01], rotation: [0, 0, 0] }], radius: 0.6 }} />
      </group>
    </SceneStoryFrame>
  )
}

const meta = { title: 'app/blaster/EmblemBadge', component: Stage, args: { imageUrl: ROCKET, ringColor: '#FFAA00' } } satisfies Meta<typeof Stage>

export default meta
type Story = StoryObj<typeof meta>

async function sceneReady({ canvasElement }: { readonly canvasElement: HTMLElement }): Promise<void> {
  const frame = within(canvasElement).getByRole('figure', { name: '3D scene' })
  await waitFor(
    async () => {
      await expect(frame.dataset['sceneReady']).toBe('true')
    },
    { timeout: 10000 },
  )
}

export const Rocket: Story = { play: sceneReady }

/** A picture that can't load: the ring colour still shows. */
export const MissingPicture: Story = { args: { imageUrl: '/no-such-art.jpg', ringColor: '#22D3EE' }, play: sceneReady }
