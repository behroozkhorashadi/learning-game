import type { components } from '@app/api/openapi_schema.pure.lib.ts'

/**
 * Types, constants, and capabilities for the profile photo panel
 * (profile_photo_capture.effect.ui.tsx): camera capture, the AI "remix"
 * previews, and the strip of every picture the profile has.
 */

/** A picture made this session (a camera photo or a remix), not saved yet. */
export interface NewPhoto {
  readonly src: string
  readonly label: string
}

/** A picture already saved on the profile (GET /api/profiles/{id}/photos). */
export type SavedPhoto = components['schemas']['ProfilePhotoRead']

export type NewProfilePhoto = components['schemas']['NewProfilePhoto']

export type PhotoRemixRequest = components['schemas']['ProfilePhotoRemixRequest']

/** Labels for backend/app/services/profile_avatars.py's PHOTO_STYLES. The prompt text behind each key lives server-side only. */
export const PHOTO_STYLES: readonly { readonly key: string; readonly label: string; readonly emoji: string }[] = [
  { key: 'storybook', label: 'Storybook', emoji: '📖' },
  { key: 'cartoon', label: 'Cartoon', emoji: '🎨' },
  { key: 'superhero', label: 'Superhero', emoji: '🦸' },
  { key: 'space', label: 'Space explorer', emoji: '🚀' },
  { key: 'wizard', label: 'Wizard', emoji: '🪄' },
  { key: 'underwater', label: 'Under the sea', emoji: '🐠' },
  { key: 'pixel', label: 'Pixel art', emoji: '👾' },
  { key: 'watercolor', label: 'Watercolor', emoji: '🖌️' },
]

/** Remix tries per photo taken. */
export const MAX_REMIXES = 3
export const MAX_IDEA_LENGTH = 120

/** How a remix is labeled in the picture strip: its look, its idea, or both ("Wizard + rainbow hair"). */
export function remixLabel(style: string | null, idea: string): string {
  const styleLabel = PHOTO_STYLES.find((s) => s.key === style)?.label
  return [styleLabel ?? '', idea].filter((part) => part !== '').join(' + ')
}

/**
 * Every photo and remix made this session goes to the server so the profile
 * keeps all of them; the one currently picked (if any) becomes the avatar.
 */
export function newPhotosPayload(newPhotos: readonly NewPhoto[], picked: string | null): readonly NewProfilePhoto[] {
  return newPhotos.map((p) => ({ image_data_url: p.src, label: p.label, use_as_avatar: p.src === picked }))
}

/** An open camera stream. */
export interface CameraSession {
  /** Shows the stream in `video` and starts playback. */
  readonly attach: (video: HTMLVideoElement) => Promise<void>
  /** A square, centre-cropped PNG data URL of the current frame, or null if no frame has arrived yet. */
  readonly snapshot: (video: HTMLVideoElement) => string | null
  readonly stop: () => void
}

export type CameraUnavailable = 'unsupported' | 'denied'

export type CameraStart = { readonly kind: 'live'; readonly session: CameraSession } | { readonly kind: 'unavailable'; readonly reason: CameraUnavailable }

/** The user-facing camera. In the app, profile_camera.effect.lib.ts over `navigator.mediaDevices`. */
export interface ProfileCamera {
  readonly start: () => Promise<CameraStart>
}
