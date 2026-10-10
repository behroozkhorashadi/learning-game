import type { ComponentType } from 'react'
import { bindProfilesApi } from '@app/api/profiles_api.effect.lib.ts'
import type { ProfilePickerProps } from './profile_picker.pure.ui.tsx'
import { bindProfilePicker } from './profile_picker.effect.ui.tsx'

/** Wires the picker to the real API. Called once by the app shell (src/App.tsx, legacy). */
export function assembleProfilePicker(): ComponentType<ProfilePickerProps> {
  const api = bindProfilesApi({ fetch: async (url, init) => fetch(url, init), baseUrl: '' })
  return bindProfilePicker({ listProfiles: api.list })
}
