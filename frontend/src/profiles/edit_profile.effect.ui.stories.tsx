import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState, type ReactElement } from 'react'
import { expect, fn, userEvent, within } from 'storybook/test'
import type { ProfileRecord } from '@app/api/profiles_schema.pure.lib.ts'
import { bindEditProfile } from './edit_profile.effect.ui.tsx'
import { LOCKED } from './profile_fixtures.test.lib.ts'
import { bindProfilePhotoCapture } from './profile_photo_capture.effect.ui.tsx'
import { SAVED, fakeCamera, fakeRemix } from './profile_photo_fixtures.test.lib.ts'
import { fakeProfilesServer } from './profiles_api_fake.test.lib.ts'

interface BoundProps {
  readonly saveFails: boolean
  readonly onSaved: (profile: ProfileRecord, password: string | null | undefined) => void
}

/** The real bound screen over an in-memory profiles server with two saved pictures. */
function Bound({ saveFails, onSaved }: BoundProps): ReactElement {
  const [EditProfile] = useState(() => {
    const server = fakeProfilesServer({ profiles: [LOCKED], photos: SAVED, ...(saveFails ? { fail: { op: 'update', message: 'Wrong password' } } : {}) })
    return bindEditProfile({
      updateProfile: server.update,
      listPhotos: server.listPhotos,
      deletePhoto: server.deletePhoto,
      PhotoCapture: bindProfilePhotoCapture({ camera: fakeCamera(), remixPhoto: fakeRemix().remixPhoto }),
      today: () => '2026-10-10',
    })
  })
  return <EditProfile profile={LOCKED} auth={{ kind: 'profile', password: 'tiger42' }} onSaved={onSaved} onCancel={fn()} />
}

const meta = {
  title: 'app/profiles/EditProfile',
  component: Bound,
  parameters: { layout: 'fullscreen' },
  args: { saveFails: false, onSaved: fn() },
} satisfies Meta<typeof Bound>

export default meta
type Story = StoryObj<typeof meta>

export const SwitchToSavedPicture: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(await canvas.findByRole('button', { name: 'Use Space explorer' }))
    await userEvent.click(canvas.getByRole('button', { name: 'Save changes' }))
    await expect(args.onSaved).toHaveBeenCalledWith(expect.objectContaining({ avatar: SAVED[1]?.url }), undefined)
  },
}

export const SaveFails: Story = {
  args: { saveFails: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Save changes' }))
    await expect(await canvas.findByRole('alert')).toHaveTextContent('Wrong password')
  },
}
