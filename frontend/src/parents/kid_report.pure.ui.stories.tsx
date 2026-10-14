import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
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

export const ThirtyDays: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { name: 'Rami' })).toBeVisible()
    await expect(canvas.getByText('Keeps missing 7 × 8 = ?')).toBeVisible()
    await userEvent.click(canvas.getByRole('tab', { name: 'Multiplication' }))
    await expect(canvas.getByLabelText('8 × 6: 0 of 1 right on the first try')).toBeVisible()
    await userEvent.click(canvas.getByRole('radio', { name: 'Last 90 days' }))
    await expect(args.onDaysChange).toHaveBeenCalledWith(90)
  },
}

export const SevenDays: Story = {
  args: { state: loaded(sampleReport(7)), days: 7 },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('radio', { name: 'Last 7 days' })).toHaveAttribute('aria-checked', 'true')
  },
}

export const NothingYet: Story = {
  args: { state: loaded(emptyReport()), days: 7 },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText("Hasn't played yet")).toBeVisible()
  },
}

export const Loading: Story = {
  args: { state: LOADING },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('Loading the report…')).toBeVisible()
  },
}

export const Failed: Story = {
  args: { state: failed('GET /api/parents/1/kids/2/report failed with HTTP 500') },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('alert')).toBeVisible()
  },
}
