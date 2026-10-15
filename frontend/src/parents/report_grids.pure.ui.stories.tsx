import type { Meta, StoryObj } from '@storybook/react-vite'
import type { ReactElement } from 'react'
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

export const Default: Story = {}
