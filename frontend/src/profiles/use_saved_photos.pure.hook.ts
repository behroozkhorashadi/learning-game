import { useEffect, useState } from 'react'
import type { SavedPhoto } from './profile_photo_state.pure.lib.ts'

export interface SavedPhotos {
  readonly photos: readonly SavedPhoto[]
  /** Deletes a saved photo on the server, then drops it from the list. Rejects with the server's message. */
  readonly remove: (photo: SavedPhoto) => Promise<void>
}

/**
 * A profile's saved pictures: loaded on mount (and when `load` changes), and
 * the one owner of the list, so a delete updates it here. A failed load
 * leaves the list empty (the panel still works for new photos). A result
 * never lands after unmount.
 *
 * `load` and `deletePhoto` must be stable for the life of the screen (bind
 * them with useState or useCallback over the profile and auth).
 */
export function useSavedPhotos(load: () => Promise<readonly SavedPhoto[]>, deletePhoto: (photo: SavedPhoto) => Promise<void>): SavedPhotos {
  const [photos, setPhotos] = useState<readonly SavedPhoto[]>([])
  useEffect(() => {
    let current = true
    load().then(
      (loaded) => {
        if (current) setPhotos(loaded)
      },
      () => undefined,
    )
    return () => {
      current = false
    }
  }, [load])

  async function remove(photo: SavedPhoto): Promise<void> {
    await deletePhoto(photo)
    setPhotos((list) => list.filter((p) => p.id !== photo.id))
  }

  return { photos, remove }
}
