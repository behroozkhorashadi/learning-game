import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { LOADING, failed, loaded } from '@app/query/query_state.pure.lib.ts'
import { PARENTS } from '@app/parents/parents_fixtures.test.lib.ts'
import { PROFILES } from './profile_fixtures.test.lib.ts'
import { ProfilePickerView } from './profile_picker.pure.ui.tsx'

const meta = {
  title: 'app/profiles/ProfilePickerView',
  component: ProfilePickerView,
  parameters: { layout: 'fullscreen' },
  args: { state: loaded(PROFILES), parents: loaded(PARENTS), onSelect: fn(), onAddPlayer: fn(), onEditProfile: fn(), onOpenAdmin: fn(), onSelectParent: fn(), onAddParent: fn() },
} satisfies Meta<typeof ProfilePickerView>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Loading: Story = {
  args: { state: LOADING },
}

export const Failed: Story = {
  args: { state: failed('GET /api/profiles failed with HTTP 500') },
}

export const NoProfilesYet: Story = {
  args: { state: loaded([]) },
}
