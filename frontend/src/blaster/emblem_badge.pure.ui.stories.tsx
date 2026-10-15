import type { Meta, StoryObj } from '@storybook/react-vite'
import type { ReactElement } from 'react'
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

const meta = {
  // Real WebGL: look at it in Storybook (`npm run storybook`); too heavy to run as a test.
  tags: ['!test'], title: 'app/blaster/EmblemBadge', component: Stage, args: { imageUrl: ROCKET, ringColor: '#FFAA00' } } satisfies Meta<typeof Stage>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

/** A picture that can't load: the ring colour still shows. */
export const MissingPicture: Story = { args: { imageUrl: '/no-such-art.jpg', ringColor: '#22D3EE' }, }
