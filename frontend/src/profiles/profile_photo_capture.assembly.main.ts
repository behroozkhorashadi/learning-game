import type { ComponentType } from 'react'
import { bindProfilesApi } from '@app/api/profiles_api.effect.lib.ts'
import { bindProfileCamera } from './profile_camera.effect.lib.ts'
import { bindProfilePhotoCapture, type ProfilePhotoCaptureProps } from './profile_photo_capture.effect.ui.tsx'

/** Wires the photo panel to the real camera and API. Used by the create screen's assembly and by legacy `games/EditProfile.tsx`. */
export function assembleProfilePhotoCapture(): ComponentType<ProfilePhotoCaptureProps> {
  const api = bindProfilesApi({ fetch: async (url, init) => fetch(url, init), baseUrl: '' })
  const camera = bindProfileCamera({
    // Typed as always present, but missing in old browsers and on insecure (non-localhost http) origins.
    mediaDevices: 'mediaDevices' in navigator ? navigator.mediaDevices : undefined,
    createCanvas: () => document.createElement('canvas'),
  })
  return bindProfilePhotoCapture({ camera, remixPhoto: api.remixPhoto })
}
