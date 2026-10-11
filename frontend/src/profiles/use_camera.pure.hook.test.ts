import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { CameraSession, CameraStart, ProfileCamera } from './profile_photo_state.pure.lib.ts'
import { useCamera } from './use_camera.pure.hook.ts'

function fakeSession(overrides: Partial<CameraSession> = {}) {
  const stop = vi.fn<() => void>()
  return { attach: () => Promise.resolve(), snapshot: (): string | null => 'data:photo', ...overrides, stop } satisfies CameraSession
}

/** A camera whose start settles only when the test says. */
function deferredCamera() {
  let settle: (result: CameraStart) => void = () => undefined
  const camera: ProfileCamera = {
    start: () =>
      new Promise((resolve) => {
        settle = resolve
      }),
  }
  return { camera, settle: (result: CameraStart) => act(async () => settle(result)) }
}

function withVideo(controls: { readonly videoRef: { current: HTMLVideoElement | null } }): void {
  controls.videoRef.current = document.createElement('video')
}

describe('useCamera', () => {
  it('goes idle → starting → live, and a photo stops the stream and returns to idle', async () => {
    const { camera, settle } = deferredCamera()
    const { result } = renderHook(() => useCamera(camera))
    withVideo(result.current)
    expect(result.current.status).toEqual({ kind: 'idle' })

    act(() => {
      void result.current.start()
    })
    expect(result.current.status).toEqual({ kind: 'starting' })

    const session = fakeSession()
    await settle({ kind: 'live', session })
    expect(result.current.status).toEqual({ kind: 'live' })

    let photo: string | null = null
    act(() => {
      photo = result.current.takePhoto()
    })
    expect(photo).toBe('data:photo')
    expect(session.stop).toHaveBeenCalledTimes(1)
    expect(result.current.status).toEqual({ kind: 'idle' })
  })

  it('stays live when there is no frame yet', async () => {
    const { camera, settle } = deferredCamera()
    const { result } = renderHook(() => useCamera(camera))
    withVideo(result.current)
    act(() => {
      void result.current.start()
    })
    const session = fakeSession({ snapshot: () => null })
    await settle({ kind: 'live', session })

    expect(result.current.takePhoto()).toBeNull()
    expect(session.stop).not.toHaveBeenCalled()
    expect(result.current.status).toEqual({ kind: 'live' })
  })

  it('reports an unavailable camera', async () => {
    const { camera, settle } = deferredCamera()
    const { result } = renderHook(() => useCamera(camera))
    act(() => {
      void result.current.start()
    })
    await settle({ kind: 'unavailable', reason: 'unsupported' })
    expect(result.current.status).toEqual({ kind: 'unavailable', reason: 'unsupported' })
  })

  it('treats a stream that will not play as denied, and stops it', async () => {
    const { camera, settle } = deferredCamera()
    const { result } = renderHook(() => useCamera(camera))
    withVideo(result.current)
    act(() => {
      void result.current.start()
    })
    const session = fakeSession({ attach: () => Promise.reject(new Error('NotAllowedError')) })
    await settle({ kind: 'live', session })
    expect(result.current.status).toEqual({ kind: 'unavailable', reason: 'denied' })
    expect(session.stop).toHaveBeenCalled()
  })

  it('stops the stream on unmount', async () => {
    const { camera, settle } = deferredCamera()
    const { result, unmount } = renderHook(() => useCamera(camera))
    withVideo(result.current)
    act(() => {
      void result.current.start()
    })
    const session = fakeSession()
    await settle({ kind: 'live', session })
    unmount()
    expect(session.stop).toHaveBeenCalledTimes(1)
  })

  it('stops a stream that opens after unmount instead of leaking it', async () => {
    const { camera, settle } = deferredCamera()
    const { result, unmount } = renderHook(() => useCamera(camera))
    act(() => {
      void result.current.start()
    })
    unmount()
    const session = fakeSession()
    await settle({ kind: 'live', session })
    expect(session.stop).toHaveBeenCalledTimes(1)
  })
})
