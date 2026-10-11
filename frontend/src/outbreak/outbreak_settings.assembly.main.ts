import type { ComponentType } from 'react'
import { bindPracticeConfigApi } from '@app/api/practice_config_api.effect.lib.ts'
import { bindOutbreakSettings, type OutbreakSettingsProps } from './outbreak_settings.effect.ui.tsx'

/** Equation Outbreak's practice settings, wired to the real API. Called once by the app shell. */
export function assembleOutbreakSettings(): ComponentType<OutbreakSettingsProps> {
  return bindOutbreakSettings({ practiceConfig: bindPracticeConfigApi({ fetch: async (url, init) => fetch(url, init), baseUrl: '' }) })
}
