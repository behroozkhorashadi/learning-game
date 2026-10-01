import type { NewPhoto } from './ProfilePhotoCapture'
import type { NewProfilePhoto } from '../types/generated'

/** Every photo/remix made this session goes to the server so the profile
 * keeps all of them; the one currently picked (if any) becomes the avatar. */
export function newPhotosPayload(newPhotos: NewPhoto[], picked: string | null): NewProfilePhoto[] {
  return newPhotos.map((p) => ({ image_data_url: p.src, label: p.label, use_as_avatar: p.src === picked }))
}
