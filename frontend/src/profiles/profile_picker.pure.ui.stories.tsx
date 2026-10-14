import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { LOADING, failed, loaded } from '@app/query/query_state.pure.lib.ts'
import { MOM, PARENTS } from '@app/parents/parents_fixtures.test.lib.ts'
import { PROFILES, RAMI } from './profile_fixtures.test.lib.ts'
import { ProfilePickerView } from './profile_picker.pure.ui.tsx'

const meta = {
  title: 'app/profiles/ProfilePickerView',
  component: ProfilePickerView,
  parameters: { layout: 'fullscreen' },
  args: { state: loaded(PROFILES), parents: loaded(PARENTS), onSelect: fn(), onAddPlayer: fn(), onEditProfile: fn(), onOpenAdmin: fn(), onSelectParent: fn(), onAddParent: fn() },
} satisfies Meta<typeof ProfilePickerView>

export default meta
type Story = StoryObj<typeof meta>

export const Loaded: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Play as Rami' }))
    await expect(args.onSelect).toHaveBeenCalledWith(RAMI)
    await userEvent.click(canvas.getByRole('button', { name: 'Edit Rami' }))
    await expect(args.onEditProfile).toHaveBeenCalledWith(RAMI)
    await expect(canvas.getByRole('button', { name: 'Play as Nora (needs a password)' })).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Parent dashboard for Mom' }))
    await expect(args.onSelectParent).toHaveBeenCalledWith(MOM)
    await userEvent.click(canvas.getByRole('button', { name: "I'm a parent" }))
    await expect(args.onAddParent).toHaveBeenCalled()
  },
}

export const Loading: Story = {
  args: { state: LOADING },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole('button', { name: 'Add a player' })).toBeNull()
  },
}

export const Failed: Story = {
  args: { state: failed('GET /api/profiles failed with HTTP 500') },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('Error: GET /api/profiles failed with HTTP 500')).toBeVisible()
  },
}

export const NoProfilesYet: Story = {
  args: { state: loaded([]) },
  play: async ({ args, canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Add a player' }))
    await expect(args.onAddPlayer).toHaveBeenCalled()
  },
}
