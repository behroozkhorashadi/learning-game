import type { Meta, StoryObj } from '@storybook/react-vite'
import type { ReactElement } from 'react'
import { expect, userEvent, within } from 'storybook/test'
import { FactGrid, WhenHeatmap } from './report_grids.pure.ui.tsx'
import { sampleReport } from './parents_fixtures.test.lib.ts'

const report = sampleReport()

function Grids(): ReactElement {
  return (
    <div style={{ display: 'grid', gap: 24, maxWidth: 760, padding: 16 }}>
      <WhenHeatmap cells={report.when} />
      <FactGrid cells={report.fact_cells} />
    </div>
  )
}

const meta = { title: 'app/parents/ReportGrids', component: Grids } satisfies Meta<typeof Grids>

export default meta
type Story = StoryObj<typeof meta>

export const HeatmapAndFacts: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('tab', { name: 'Division' }))
    await expect(canvas.getByLabelText('35 ÷ 7: 0 of 3 right on the first try')).toBeVisible()
  },
}
