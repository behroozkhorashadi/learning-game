import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState, type ReactElement } from 'react'
import { expect, fn, userEvent, within } from 'storybook/test'
import { fakeCamera } from '@app/profiles/profile_photo_fixtures.test.lib.ts'
import { bindArtStudio } from './art_studio.effect.ui.tsx'
import { fakeArmory } from './horde_fakes.test.ui.tsx'

/** The bound studio over a fake camera and a fake armory server. */
function Bound({ onBack }: { readonly onBack: () => void }): ReactElement {
  const [armory] = useState(() => fakeArmory({ balance: 700 }))
  const [ArtStudio] = useState(() => bindArtStudio({ camera: fakeCamera(), gallery: armory.gallery, createArt: armory.createArt }))
  const [balance, setBalance] = useState(armory.state().balance)
  return (
    <ArtStudio
      profileId={1}
      balance={balance}
      price={300}
      onSpent={() => {
        setBalance(armory.state().balance)
      }}
      onBack={onBack}
    />
  )
}

const meta = {
  title: 'app/horde/ArtStudio',
  component: Bound,
  args: { onBack: fn() },
} satisfies Meta<typeof Bound>

export default meta
type Story = StoryObj<typeof meta>

export const SelfieToArt: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Open camera' }))
    await userEvent.click(await canvas.findByRole('button', { name: 'Take selfie' }))
    await userEvent.click(canvas.getByRole('button', { name: '💥 Comic Hero' }))
    await userEvent.click(canvas.getByRole('button', { name: 'Create art · 300 points' }))
    await expect(await canvas.findByText('Saved to your gallery!')).toBeVisible()
    await expect(canvas.getByRole('status', { name: 'Points' })).toHaveTextContent('400 points')
  },
}
