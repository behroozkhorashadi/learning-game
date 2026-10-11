import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState, type ReactElement } from 'react'
import { expect, fn, userEvent, within } from 'storybook/test'
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

export const TakeAndRemix: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Open camera' }))
    await userEvent.click(await canvas.findByRole('button', { name: 'Take photo' }))
    await userEvent.click(canvas.getByRole('button', { name: /Wizard/ }))
    await userEvent.click(canvas.getByRole('button', { name: 'Try it (3 tries left)' }))
    await expect(await canvas.findByRole('button', { name: 'Use Wizard' })).toBeVisible()
  },
}

export const RemixFails: Story = {
  args: { remixFails: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Open camera' }))
    await userEvent.click(await canvas.findByRole('button', { name: 'Take photo' }))
    await userEvent.click(canvas.getByRole('button', { name: /Cartoon/ }))
    await userEvent.click(canvas.getByRole('button', { name: /Try it/ }))
    await expect(await canvas.findByText("AI photo remix isn't available right now")).toBeVisible()
  },
}

export const CameraDenied: Story = {
  args: { camera: 'denied' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Open camera' }))
    await expect(await canvas.findByText(/Camera access was not available/)).toBeVisible()
  },
}

export const SavedPictures: Story = {
  args: { saved: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Delete Space explorer' }))
    await userEvent.click(canvas.getByRole('button', { name: 'Really delete Space explorer?' }))
    await expect(await canvas.findByText('server said no')).toBeVisible()
  },
}
