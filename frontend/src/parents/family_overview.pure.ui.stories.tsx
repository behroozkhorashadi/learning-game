import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { loaded } from '@app/query/query_state.pure.lib.ts'
import { FamilyOverview } from './family_overview.pure.ui.tsx'
import { KID_SUMMARIES, MOM } from './parents_fixtures.test.lib.ts'

const meta = {
  title: 'app/parents/FamilyOverview',
  component: FamilyOverview,
  parameters: { layout: 'fullscreen' },
  args: { parent: MOM, state: loaded(KID_SUMMARIES), onOpenKid: fn(), onSignOut: fn() },
} satisfies Meta<typeof FamilyOverview>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const NoKidsLinked: Story = {
  args: { state: loaded([]) },
}
