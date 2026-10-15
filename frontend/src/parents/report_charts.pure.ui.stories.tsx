import type { Meta, StoryObj } from '@storybook/react-vite'
import type { ReactElement } from 'react'
import { CHART, ChartCard, DailyChart, LineChart } from './report_charts.pure.ui.tsx'
import { sampleReport } from './parents_fixtures.test.lib.ts'

const report = sampleReport()

function Charts(): ReactElement {
  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 760, padding: 16 }}>
      <ChartCard title="How much they play" subtitle="Minutes per day">
        <DailyChart days={report.daily} games={report.games.map((g) => ({ id: g.game_id, title: g.title }))} />
      </ChartCard>
      <ChartCard title="Getting better?" subtitle="First try by week">
        <LineChart
          xLabels={report.weekly.map((w) => w.week_start.slice(5))}
          yMax={100}
          format={(v) => `${String(v)}%`}
          ariaLabel="First-try accuracy by week"
          series={[
            { label: 'Math', color: CHART.series[0], values: report.weekly.map((w) => w.math_first_try_pct) },
            { label: 'Reading', color: CHART.series[1], values: report.weekly.map((w) => w.reading_first_try_pct) },
          ]}
        />
      </ChartCard>
    </div>
  )
}

const meta = { title: 'app/parents/ReportCharts', component: Charts } satisfies Meta<typeof Charts>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
