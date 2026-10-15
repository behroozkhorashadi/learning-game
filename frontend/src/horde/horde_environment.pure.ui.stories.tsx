import type { Meta, StoryObj } from '@storybook/react-vite'
import type { ReactElement } from 'react'
import { SceneStoryFrame } from '@app/arena/scene_story_frame.test.ui.tsx'
import { HordeEnvironment } from './horde_environment.pure.ui.tsx'
import { CAMERA_POSITION, COVER } from './horde_field.pure.lib.ts'

function Stage({ billboardUrl }: { readonly billboardUrl: string | null }): ReactElement {
  return (
    <SceneStoryFrame camera={CAMERA_POSITION} fov={56} height={480}>
      <HordeEnvironment cover={COVER} shadows billboardUrl={billboardUrl} />
    </SceneStoryFrame>
  )
}

const meta = {
  // Real WebGL: look at it in Storybook (`npm run storybook`); too heavy to run as a test.
  tags: ['!test'],
  title: 'app/horde/HordeEnvironment',
  component: Stage,
  parameters: { layout: 'fullscreen' },
  args: { billboardUrl: null },
} satisfies Meta<typeof Stage>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

const ART = `data:image/svg+xml;charset=utf-8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#FFB020"/><text x="128" y="140" font-size="150" text-anchor="middle" dominant-baseline="middle">🦖</text></svg>')}`

/** With the Horde Billboard: the kid's art hung high over the back of the field. */
export const WithBillboard: Story = { args: { billboardUrl: ART }, }
