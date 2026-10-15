import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState, type ReactElement } from 'react'
import { fn } from 'storybook/test'
import type { PracticeConfigRecord } from '@app/api/practice_config_schema.pure.lib.ts'
import { bindOutbreakSettings } from './outbreak_settings.effect.ui.tsx'

/** The real bound screen over a fake practice-config API. */
function Bound({ saved, saveFails, onBack }: { readonly saved: PracticeConfigRecord | null; readonly saveFails: boolean; readonly onBack: () => void }): ReactElement {
  const [OutbreakSettings] = useState(() =>
    bindOutbreakSettings({
      practiceConfig: {
        get: () => Promise.resolve(saved),
        save: () => (saveFails ? Promise.reject(new Error('Pick at least one operation')) : Promise.resolve()),
        clear: () => Promise.resolve(),
      },
    }),
  )
  return <OutbreakSettings profileId={1} onBack={onBack} />
}

const meta = {
  title: 'app/outbreak/OutbreakSettings',
  component: Bound,
  parameters: { layout: 'fullscreen' },
  args: { saved: null, saveFails: false, onBack: fn() },
} satisfies Meta<typeof Bound>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const SaveFails: Story = {
  args: { saved: { profile_id: 1, game_id: 'fact_fluency', operations: ['×'], focus_numbers: {}, difficulty: 5 }, saveFails: true },
}
