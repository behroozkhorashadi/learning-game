import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { LOADING, failed, loaded } from '@app/query/query_state.pure.lib.ts'
import { KidReportView } from './kid_report.pure.ui.tsx'
import { emptyReport, sampleReport } from './parents_fixtures.test.lib.ts'

const meta = {
  title: 'app/parents/KidReportView',
  component: KidReportView,
  parameters: { layout: 'fullscreen' },
  args: { state: loaded(sampleReport()), days: 30, onDaysChange: fn(), onBack: fn() },
} satisfies Meta<typeof KidReportView>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const SevenDays: Story = {
  args: { state: loaded(sampleReport(7)), days: 7 },
}

export const NothingYet: Story = {
  args: { state: loaded(emptyReport()), days: 7 },
}

export const Loading: Story = {
  args: { state: LOADING },
}

export const Failed: Story = {
  args: { state: failed('GET /api/parents/1/kids/2/report failed with HTTP 500') },
}
