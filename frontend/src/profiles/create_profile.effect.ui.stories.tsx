import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState, type ReactElement } from 'react'
import { fn } from 'storybook/test'
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

export const Default: Story = {}

export const CreateFails: Story = {
  args: { create: 'fails' },
}
