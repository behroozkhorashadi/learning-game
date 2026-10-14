import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { PARENTS } from '@app/parents/parents_fixtures.test.lib.ts'
import { ParentSelect } from './parent_select.pure.ui.tsx'

const meta = {
  title: 'app/profiles/ParentSelect',
  component: ParentSelect,
  args: { parents: PARENTS, value: null, onChange: fn() },
  decorators: [(Story) => <div style={{ maxWidth: 480, padding: 16 }}>{Story()}</div>],
} satisfies Meta<typeof ParentSelect>

export default meta
type Story = StoryObj<typeof meta>

export const PickAParent: Story = {
  play: async ({ args, canvasElement }) => {
    await userEvent.selectOptions(within(canvasElement).getByRole('combobox', { name: /Parent/ }), 'Dad')
    await expect(args.onChange).toHaveBeenCalledWith(2)
  },
}

export const NoParentsYet: Story = {
  args: { parents: [] },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(/A grown-up can add one/)).toBeVisible()
  },
}
