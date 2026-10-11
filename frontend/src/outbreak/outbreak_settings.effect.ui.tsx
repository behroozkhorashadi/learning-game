import { useState, type ComponentType, type ReactElement } from 'react'
import type { PracticeConfigApi } from '@app/api/practice_config_api.effect.lib.ts'
import type { PracticeConfigRecord } from '@app/api/practice_config_schema.pure.lib.ts'
import { errorMessage } from '@app/query/query_state.pure.lib.ts'
import { useQuery } from '@app/query/use_query.pure.hook.ts'
import { FACT_FLUENCY_GAME_ID } from './fact_fluency_brain.effect.lib.ts'
import { draftFrom, settingsSave, type SettingsDraft } from './outbreak_settings_form.pure.lib.ts'
import { OutbreakSettingsView } from './outbreak_settings.pure.ui.tsx'

/**
 * Equation Outbreak's practice settings screen: loads the profile's saved
 * settings (GET /api/practice-config), lets a parent edit them, and saves
 * (PUT) or, when custom settings are turned off, clears them (DELETE).
 */

export interface OutbreakSettingsProps {
  readonly profileId: number
  readonly onBack: () => void
}

export interface OutbreakSettingsDeps {
  readonly practiceConfig: Pick<PracticeConfigApi, 'get' | 'save' | 'clear'>
}

export function bindOutbreakSettings({ practiceConfig }: OutbreakSettingsDeps): ComponentType<OutbreakSettingsProps> {
  /** The form, mounted once the saved settings are in: it owns the draft from then on. */
  function SettingsForm({ profileId, saved, initialError, onBack }: OutbreakSettingsProps & { readonly saved: PracticeConfigRecord | null; readonly initialError: string | null }): ReactElement {
    const [draft, setDraft] = useState<SettingsDraft>(() => draftFrom(saved))
    const [hadSavedConfig, setHadSavedConfig] = useState(saved !== null)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(initialError)

    async function save(): Promise<void> {
      setSaving(true)
      setError(null)
      try {
        const action = settingsSave(draft, hadSavedConfig, profileId, FACT_FLUENCY_GAME_ID)
        if (action.kind === 'save') {
          await practiceConfig.save(action.config)
          setHadSavedConfig(true)
        } else if (action.kind === 'clear') {
          await practiceConfig.clear(profileId, FACT_FLUENCY_GAME_ID)
          setHadSavedConfig(false)
        }
        onBack()
      } catch (err) {
        setError(errorMessage(err))
      } finally {
        setSaving(false)
      }
    }

    return (
      <OutbreakSettingsView
        draft={draft}
        onChange={setDraft}
        saving={saving}
        error={error}
        onSave={() => {
          void save()
        }}
        onCancel={onBack}
      />
    )
  }

  function Loader({ profileId, onBack }: OutbreakSettingsProps): ReactElement | null {
    // One profile per mount (the screen keys this by profile), so the load is fixed for the mount's life.
    const [load] = useState(() => () => practiceConfig.get(profileId, FACT_FLUENCY_GAME_ID))
    const state = useQuery(load)
    if (state.kind === 'loading') return null
    if (state.kind === 'failed') {
      // A failed load still shows the form (with the defaults) and why, as before.
      return <SettingsForm profileId={profileId} saved={null} initialError={state.message} onBack={onBack} />
    }
    return <SettingsForm profileId={profileId} saved={state.data} initialError={null} onBack={onBack} />
  }

  function OutbreakSettings({ profileId, onBack }: OutbreakSettingsProps): ReactElement {
    return <Loader key={profileId} profileId={profileId} onBack={onBack} />
  }
  return OutbreakSettings
}
