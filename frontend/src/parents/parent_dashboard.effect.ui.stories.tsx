import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState, type ReactElement } from 'react'
import { fn } from 'storybook/test'
import { bindParentDashboard } from './parent_dashboard.effect.ui.tsx'
import { KID_SUMMARIES, MOM, sampleReport } from './parents_fixtures.test.lib.ts'

/** The real bound dashboard over fake loaders: no backend. */
function Bound(): ReactElement {
  const [Dashboard] = useState(() =>
    bindParentDashboard({
      listKids: () => Promise.resolve(KID_SUMMARIES),
      loadReport: (_parent, _kid, _password, days) => Promise.resolve(sampleReport(days)),
    }),
  )
  return <Dashboard parent={MOM} password="pw" onSignOut={fn()} />
}

const meta = { title: 'app/parents/ParentDashboard', component: Bound, parameters: { layout: 'fullscreen' } } satisfies Meta<typeof Bound>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
