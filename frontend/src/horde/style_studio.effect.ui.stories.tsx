import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState, type ReactElement } from 'react'
import { expect, fn, userEvent, within } from 'storybook/test'
import { picture } from '@app/profiles/profile_photo_fixtures.test.lib.ts'
import { fakeArmory } from './horde_fakes.test.ui.tsx'
import { bindStyleStudio } from './style_studio.effect.ui.tsx'

/** The bound studio over a fake armory server with 600 points and two pieces of art. */
function Bound({ onBack }: { readonly onBack: () => void }): ReactElement {
  const [armory] = useState(() =>
    fakeArmory({
      balance: 600,
      art: [
        { id: 'art-1', profile_id: 1, image_url: picture('#9D57FA'), style: 'comic_hero', idea: 'a dragon', created_at: '2026-10-11T12:00:00Z' },
        { id: 'art-2', profile_id: 1, image_url: picture('#5BCC2D'), style: 'pixel_hero', idea: '', created_at: '2026-10-11T12:00:00Z' },
      ],
    }),
  )
  const [StyleStudio] = useState(() => bindStyleStudio({ looks: armory.looks, saveLooks: armory.saveLooks, gallery: armory.gallery, purchase: armory.purchase }))
  const [state, setState] = useState(armory.state())
  return (
    <StyleStudio
      profileId={1}
      armory={state}
      onSpent={() => {
        setState(armory.state())
      }}
      onSaved={() => undefined}
      onBack={onBack}
    />
  )
}

const meta = {
  title: 'app/horde/StyleStudio',
  component: Bound,
  args: { onBack: fn() },
} satisfies Meta<typeof Bound>

export default meta
type Story = StoryObj<typeof meta>

/** Unlock suit paint and the emblem maker, paint the suit, pick an emblem, and save. */
export const DesignALook: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(await canvas.findByRole('button', { name: 'Unlock Suit Paint Studio for 150 points' }))
    await userEvent.click(within(await canvas.findByRole('group', { name: 'Suit colour' })).getByRole('button', { name: 'Purple' }))
    await userEvent.click(canvas.getByRole('button', { name: 'Glowing' }))
    await userEvent.click(canvas.getByRole('button', { name: 'Unlock Emblem Maker for 120 points' }))
    await userEvent.click(await canvas.findByRole('button', { name: 'Comic Hero: a dragon' }))
    await userEvent.click(canvas.getByRole('button', { name: 'Save my look' }))
    await expect(await canvas.findByText('✓ Saved! Your new look is on.')).toBeVisible()
    await expect(canvas.getByRole('status', { name: 'Points' })).toHaveTextContent('330 points')
  },
}
