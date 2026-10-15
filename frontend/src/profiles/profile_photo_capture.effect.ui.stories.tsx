import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState, type ReactElement } from 'react'
import { fn } from 'storybook/test'
import { bindProfilePhotoCapture } from './profile_photo_capture.effect.ui.tsx'
import { SAVED, fakeCamera, fakeRemix } from './profile_photo_fixtures.test.lib.ts'
import type { CameraUnavailable } from './profile_photo_state.pure.lib.ts'

interface BoundProps {
  readonly camera: 'live' | CameraUnavailable
  readonly remixFails: boolean
  readonly saved: boolean
}

/** The real bound panel over a fake camera and remix service, under a parent that owns the picked picture. */
function Bound({ camera, remixFails, saved }: BoundProps): ReactElement {
  const [PhotoCapture] = useState(() =>
    bindProfilePhotoCapture({ camera: fakeCamera(camera), remixPhoto: fakeRemix(remixFails ? "AI photo remix isn't available right now" : null).remixPhoto }),
  )
  const [value, setValue] = useState<string | null>(saved ? (SAVED[0]?.url ?? null) : null)
  return (
    <PhotoCapture
      value={value}
      onChange={setValue}
      onNewPhotosChange={fn()}
      {...(saved ? { savedPhotos: SAVED, onDeleteSaved: () => Promise.reject(new Error('server said no')) } : {})}
    />
  )
}

const meta = {
  title: 'app/profiles/ProfilePhotoCapture',
  component: Bound,
  args: { camera: 'live', remixFails: false, saved: false },
} satisfies Meta<typeof Bound>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const RemixFails: Story = {
  args: { remixFails: true },
}

export const CameraDenied: Story = {
  args: { camera: 'denied' },
}

export const SavedPictures: Story = {
  args: { saved: true },
}
