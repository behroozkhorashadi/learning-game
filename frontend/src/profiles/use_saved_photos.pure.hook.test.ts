import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SAVED } from './profile_photo_fixtures.test.lib.ts'
import type { SavedPhoto } from './profile_photo_state.pure.lib.ts'
import { useSavedPhotos } from './use_saved_photos.pure.hook.ts'

describe('useSavedPhotos', () => {
  it('loads the photos and drops one once the server deletes it', async () => {
    const deleted: number[] = []
    const load = (): Promise<readonly SavedPhoto[]> => Promise.resolve(SAVED)
    const remove = (photo: SavedPhoto): Promise<void> => {
      deleted.push(photo.id)
      return Promise.resolve()
    }
    const { result } = renderHook(() => useSavedPhotos(load, remove))
    await waitFor(() => {
      expect(result.current.photos).toHaveLength(2)
    })
    const second = SAVED[1]
    if (second === undefined) throw new Error('fixture needs two photos')
    await act(() => result.current.remove(second))
    expect(deleted).toEqual([2])
    expect(result.current.photos.map((p) => p.id)).toEqual([1])
  })

  it('keeps the photo when the delete fails, and rejects with the reason', async () => {
    const load = (): Promise<readonly SavedPhoto[]> => Promise.resolve(SAVED)
    const remove = (): Promise<void> => Promise.reject(new Error('server said no'))
    const { result } = renderHook(() => useSavedPhotos(load, remove))
    await waitFor(() => {
      expect(result.current.photos).toHaveLength(2)
    })
    const first = SAVED[0]
    if (first === undefined) throw new Error('fixture needs a photo')
    await expect(act(() => result.current.remove(first))).rejects.toThrow('server said no')
    expect(result.current.photos).toHaveLength(2)
  })

  it('stays empty when the load fails', async () => {
    let settled = false
    const load = (): Promise<readonly SavedPhoto[]> => Promise.reject(new Error('403')).finally(() => (settled = true))
    const { result } = renderHook(() => useSavedPhotos(load, () => Promise.resolve()))
    await waitFor(() => {
      expect(settled).toBe(true)
    })
    expect(result.current.photos).toEqual([])
  })

  it('drops a result that arrives after unmount', async () => {
    let resolve: (photos: readonly SavedPhoto[]) => void = () => undefined
    const load = (): Promise<readonly SavedPhoto[]> =>
      new Promise((r) => {
        resolve = r
      })
    const { result, unmount } = renderHook(() => useSavedPhotos(load, () => Promise.resolve()))
    unmount()
    await act(async () => {
      resolve(SAVED)
    })
    expect(result.current.photos).toEqual([])
  })
})
