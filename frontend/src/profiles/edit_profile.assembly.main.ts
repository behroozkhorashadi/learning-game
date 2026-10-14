import type { ComponentType } from 'react'
import { bindParentsApi } from '@app/api/parents_api.effect.lib.ts'
import { bindProfilesApi } from '@app/api/profiles_api.effect.lib.ts'
import { bindEditProfile, type EditProfileProps } from './edit_profile.effect.ui.tsx'
import { assembleProfilePhotoCapture } from './profile_photo_capture.assembly.main.ts'

/** Wires the edit screen to the real API, camera, and clock. Called once by the app shell and by the admin panel's assembly. */
export function assembleEditProfile(): ComponentType<EditProfileProps> {
  const api = bindProfilesApi({ fetch: async (url, init) => fetch(url, init), baseUrl: '' })
  return bindEditProfile({
    updateProfile: api.update,
    listPhotos: api.listPhotos,
    deletePhoto: api.deletePhoto,
    PhotoCapture: assembleProfilePhotoCapture(),
    today: () => new Date().toISOString().slice(0, 10),
    listParents: bindParentsApi({ fetch: async (url, init) => fetch(url, init), baseUrl: '' }).list,
  })
}
