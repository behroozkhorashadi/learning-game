import { useEffect, useRef, useState, type RefObject } from 'react'
import type { CameraSession, CameraUnavailable, ProfileCamera } from './profile_photo_state.pure.lib.ts'

export type CameraStatus =
  | { readonly kind: 'idle' }
  | { readonly kind: 'starting' }
  | { readonly kind: 'live' }
  | { readonly kind: 'unavailable'; readonly reason: CameraUnavailable }

export interface CameraControls {
  readonly status: CameraStatus
  /** Put this on the `<video>` the stream should play in. */
  readonly videoRef: RefObject<HTMLVideoElement | null>
  readonly start: () => Promise<void>
  /** Takes a photo of the current frame and turns the camera off. Null if there's no frame yet (the camera stays on). */
  readonly takePhoto: () => string | null
}

const IDLE: CameraStatus = { kind: 'idle' }

/**
 * Drives the injected camera: idle → starting → live → (photo) → idle, or
 * unavailable. The stream is stopped after a photo, on unmount, and if it
 * opens after the component has already gone.
 */
export function useCamera(camera: ProfileCamera): CameraControls {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const sessionRef = useRef<CameraSession | null>(null)
  const mountedRef = useRef(true)
  const [status, setStatus] = useState<CameraStatus>(IDLE)
  // A function, not the bare ref, so the check is re-read after each await.
  const isMounted = (): boolean => mountedRef.current

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      sessionRef.current?.stop()
      sessionRef.current = null
    }
  }, [])

  async function start(): Promise<void> {
    setStatus({ kind: 'starting' })
    const result = await camera.start()
    if (result.kind === 'unavailable') {
      if (isMounted()) setStatus(result)
      return
    }
    if (!isMounted()) {
      result.session.stop()
      return
    }
    sessionRef.current = result.session
    // Read the video only now: a caller that was showing a photo has re-rendered the <video> by the time the camera opens.
    const video = videoRef.current
    try {
      if (video !== null) await result.session.attach(video)
      if (isMounted()) setStatus({ kind: 'live' })
    } catch {
      result.session.stop()
      sessionRef.current = null
      if (isMounted()) setStatus({ kind: 'unavailable', reason: 'denied' })
    }
  }

  function takePhoto(): string | null {
    const session = sessionRef.current
    const video = videoRef.current
    if (session === null || video === null) return null
    const photo = session.snapshot(video)
    if (photo === null) return null
    session.stop()
    sessionRef.current = null
    setStatus(IDLE)
    return photo
  }

  return { status, videoRef, start, takePhoto }
}
