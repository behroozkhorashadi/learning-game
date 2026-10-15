import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState, type ReactElement } from 'react'
import { fn } from 'storybook/test'
import { draftFrom, type SettingsDraft } from './outbreak_settings_form.pure.lib.ts'
import { OutbreakSettingsView } from './outbreak_settings.pure.ui.tsx'

function Stage({ initial, error, onSave }: { readonly initial: SettingsDraft; readonly error: string | null; readonly onSave: () => void }): ReactElement {
  const [draft, setDraft] = useState(initial)
  return <OutbreakSettingsView draft={draft} onChange={setDraft} saving={false} error={error} onSave={onSave} onCancel={fn()} />
}

const meta = {
  title: 'app/outbreak/OutbreakSettingsView',
  component: Stage,
  parameters: { layout: 'fullscreen' },
  args: { initial: draftFrom(null), error: null, onSave: fn() },
} satisfies Meta<typeof Stage>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Customized: Story = { args: { initial: draftFrom({ profile_id: 1, game_id: 'fact_fluency', operations: ['×'], focus_numbers: { '×': [7, 8] }, difficulty: 8 }) } }

export const SaveFailed: Story = {
  args: { error: 'Pick at least one operation' },
}
