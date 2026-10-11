import type { ComponentType } from 'react'
import { bindProfilesApi } from '@app/api/profiles_api.effect.lib.ts'
import { bindCreateProfile, type CreateProfileProps } from './create_profile.effect.ui.tsx'
import { assembleProfilePhotoCapture } from './profile_photo_capture.assembly.main.ts'

/** Wires the create screen to the real API, camera, and clock. Called once by the app shell (src/App.tsx, legacy). */
export function assembleCreateProfile(): ComponentType<CreateProfileProps> {
  const api = bindProfilesApi({ fetch: async (url, init) => fetch(url, init), baseUrl: '' })
  return bindCreateProfile({
    createProfile: api.create,
    PhotoCapture: assembleProfilePhotoCapture(),
    today: () => new Date().toISOString().slice(0, 10),
  })
}
