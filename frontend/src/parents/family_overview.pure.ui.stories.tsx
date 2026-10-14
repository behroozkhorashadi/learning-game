import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { loaded } from '@app/query/query_state.pure.lib.ts'
import { FamilyOverview } from './family_overview.pure.ui.tsx'
import { KID_SUMMARIES, MOM, RAMI_SUMMARY } from './parents_fixtures.test.lib.ts'

const meta = {
  title: 'app/parents/FamilyOverview',
  component: FamilyOverview,
  parameters: { layout: 'fullscreen' },
  args: { parent: MOM, state: loaded(KID_SUMMARIES), onOpenKid: fn(), onSignOut: fn() },
} satisfies Meta<typeof FamilyOverview>

export default meta
type Story = StoryObj<typeof meta>

export const TwoKids: Story = {
  play: async ({ args, canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: "Open Rami's report" }))
    await expect(args.onOpenKid).toHaveBeenCalledWith(RAMI_SUMMARY)
  },
}

export const NoKidsLinked: Story = {
  args: { state: loaded([]) },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('No kids linked yet.')).toBeVisible()
  },
}
