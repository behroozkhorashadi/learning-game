import type { Meta, StoryObj } from '@storybook/react-vite'
import { createRef } from 'react'
import { expect, fn, userEvent, within } from 'storybook/test'
import { picture } from '@app/profiles/profile_photo_fixtures.test.lib.ts'
import { loaded } from '@app/query/query_state.pure.lib.ts'
import { ArtStudioView } from './art_studio_view.pure.ui.tsx'

const GALLERY = [
  { id: 'a2', profile_id: 1, image_url: picture('#9D57FA'), style: 'zombie_slayer', idea: 'a cape', created_at: '' },
  { id: 'a1', profile_id: 1, image_url: picture('#5BCC2D'), style: 'pixel_hero', idea: '', created_at: '' },
] as const

const meta = {
  title: 'app/horde/ArtStudioView',
  component: ArtStudioView,
  args: {
    balance: 420,
    price: 300,
    camera: { kind: 'idle' },
    videoRef: createRef<HTMLVideoElement>(),
    selfie: picture('#F59E0B'),
    style: 'zombie_slayer',
    idea: '',
    making: false,
    error: null,
    latest: null,
    gallery: loaded(GALLERY),
    onOpenCamera: fn(),
    onTakePhoto: fn(),
    onRetake: fn(),
    onStyle: fn(),
    onIdea: fn(),
    onCreate: fn(),
    onBack: fn(),
  },
} satisfies Meta<typeof ArtStudioView>

export default meta
type Story = StoryObj<typeof meta>

export const ReadyToCreate: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Create art · 300 points' }))
    await expect(args.onCreate).toHaveBeenCalled()
    await expect(canvas.getByRole('img', { name: 'Zombie Slayer: a cape' })).toBeVisible()
  },
}

export const JustMade: Story = {
  args: { latest: GALLERY[0], balance: 120 },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('Saved to your gallery!')).toBeVisible()
  },
}

export const NotEnoughPoints: Story = {
  args: { balance: 90, selfie: null },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(/You need 210 more points/)).toBeVisible()
  },
}

export const AiUnavailable: Story = {
  args: { error: "the art studio can't make art right now; no points were spent" },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('alert')).toHaveTextContent('no points were spent')
  },
}
