import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState, type ReactElement } from 'react'
import { expect, fn, within } from 'storybook/test'
import { PARENTS } from '@app/parents/parents_fixtures.test.lib.ts'
import { PROFILES } from './profile_fixtures.test.lib.ts'
import { bindProfilePicker } from './profile_picker.effect.ui.tsx'

type ListMode = 'succeeds' | 'fails'

/** The real bound screen over a fake list capability — no backend. */
function Bound({ list }: { readonly list: ListMode }): ReactElement {
  const [ProfilePicker] = useState(() =>
    bindProfilePicker({
      listProfiles: () => (list === 'succeeds' ? Promise.resolve(PROFILES) : Promise.reject(new Error('GET /api/profiles failed with HTTP 503'))),
      listParents: () => Promise.resolve(PARENTS),
    }),
  )
  return <ProfilePicker onSelect={fn()} onAddPlayer={fn()} onEditProfile={fn()} onOpenAdmin={fn()} onSelectParent={fn()} onAddParent={fn()} />
}

const meta = {
  title: 'app/profiles/ProfilePicker',
  component: Bound,
  parameters: { layout: 'fullscreen' },
  args: { list: 'succeeds' },
} satisfies Meta<typeof Bound>

export default meta
type Story = StoryObj<typeof meta>

export const LoadsProfiles: Story = {
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByRole('button', { name: 'Play as Demo Kid' })).toBeVisible()
  },
}

export const ListFails: Story = {
  args: { list: 'fails' },
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByText('Error: GET /api/profiles failed with HTTP 503')).toBeVisible()
  },
}
