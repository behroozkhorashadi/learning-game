import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState, type ReactElement } from 'react'
import { expect, fn, userEvent, within } from 'storybook/test'
import type { ProfileRecord } from '@app/api/profiles_schema.pure.lib.ts'
import { PARENTS } from '@app/parents/parents_fixtures.test.lib.ts'
import { bindCreateProfile } from './create_profile.effect.ui.tsx'
import { bindProfilePhotoCapture } from './profile_photo_capture.effect.ui.tsx'
import { fakeCamera, fakeRemix } from './profile_photo_fixtures.test.lib.ts'

const NORA: ProfileRecord = { id: 3, name: 'Nora', avatar: 'cat', birth_year: 2019, reading_support: false, has_password: false, created_at: null, parent_id: null }

interface BoundProps {
  readonly create: 'succeeds' | 'fails'
  readonly onCreated: (profile: ProfileRecord, password: string | null) => void
}

/** The real bound screen over fake create, camera, and remix capabilities and a fixed clock. */
function Bound({ create, onCreated }: BoundProps): ReactElement {
  const [CreateProfile] = useState(() =>
    bindCreateProfile({
      createProfile: () => (create === 'succeeds' ? Promise.resolve(NORA) : Promise.reject(new Error('name must not be blank'))),
      PhotoCapture: bindProfilePhotoCapture({ camera: fakeCamera(), remixPhoto: fakeRemix().remixPhoto }),
      today: () => '2026-10-10',
      listParents: () => Promise.resolve(PARENTS),
    }),
  )
  return <CreateProfile onCreated={onCreated} onCancel={fn()} onAddParent={fn()} />
}

const meta = {
  title: 'app/profiles/CreateProfile',
  component: Bound,
  parameters: { layout: 'fullscreen' },
  args: { create: 'succeeds', onCreated: fn() },
} satisfies Meta<typeof Bound>

export default meta
type Story = StoryObj<typeof meta>

async function fillValidForm(canvasElement: HTMLElement): Promise<void> {
  const canvas = within(canvasElement)
  await userEvent.type(canvas.getByPlaceholderText('What should we call them?'), 'Nora')
  await userEvent.type(canvas.getByLabelText('Birthday'), '2019-05-12')
  await userEvent.click(canvas.getByRole('button', { name: 'Choose the cat avatar' }))
}

export const Creates: Story = {
  play: async ({ args, canvasElement }) => {
    await fillValidForm(canvasElement)
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Create profile' }))
    await expect(args.onCreated).toHaveBeenCalledWith(NORA, null)
  },
}

export const CreateFails: Story = {
  args: { create: 'fails' },
  play: async ({ args, canvasElement }) => {
    await fillValidForm(canvasElement)
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Create profile' }))
    await expect(await canvas.findByRole('alert')).toHaveTextContent('name must not be blank')
    await expect(args.onCreated).not.toHaveBeenCalled()
  },
}
