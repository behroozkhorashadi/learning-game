import type { ComponentType } from 'react'
import { bindProfilesApi } from '@app/api/profiles_api.effect.lib.ts'
import { bindProfileUnlock, type ProfileUnlockProps } from './profile_unlock.effect.ui.tsx'

/** Wires the unlock prompt to the real API. Called once by the app shell. */
export function assembleProfileUnlock(): ComponentType<ProfileUnlockProps> {
  const api = bindProfilesApi({ fetch: async (url, init) => fetch(url, init), baseUrl: '' })
  return bindProfileUnlock({ unlockProfile: api.unlock })
}
