import type { CameraSession, CameraStart, ProfileCamera } from './profile_photo_state.pure.lib.ts'

const SNAPSHOT_SIZE = 512

export interface ProfileCameraDeps {
  /** `navigator.mediaDevices`, or undefined where the browser offers none (old browsers, insecure origins). */
  readonly mediaDevices: Pick<MediaDevices, 'getUserMedia'> | undefined
  /** `() => document.createElement('canvas')`, for snapshots. */
  readonly createCanvas: () => HTMLCanvasElement
}

/** The user-facing camera over the browser's media devices. */
export function bindProfileCamera({ mediaDevices, createCanvas }: ProfileCameraDeps): ProfileCamera {
  function sessionFor(stream: MediaStream): CameraSession {
    return {
      attach: async (video) => {
        video.srcObject = stream
        await video.play()
      },
      snapshot: (video) => {
        if (video.videoWidth === 0 || video.videoHeight === 0) return null
        const canvas = createCanvas()
        canvas.width = SNAPSHOT_SIZE
        canvas.height = SNAPSHOT_SIZE
        const context = canvas.getContext('2d')
        if (context === null) return null
        // Centre-crop the largest square, so the face stays in the middle of a round avatar.
        const side = Math.min(video.videoWidth, video.videoHeight)
        context.drawImage(video, (video.videoWidth - side) / 2, (video.videoHeight - side) / 2, side, side, 0, 0, SNAPSHOT_SIZE, SNAPSHOT_SIZE)
        return canvas.toDataURL('image/png')
      },
      stop: () => {
        for (const track of stream.getTracks()) track.stop()
      },
    }
  }

  return {
    start: async (): Promise<CameraStart> => {
      if (mediaDevices === undefined) return { kind: 'unavailable', reason: 'unsupported' }
      try {
        const stream = await mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 720 } }, audio: false })
        return { kind: 'live', session: sessionFor(stream) }
      } catch {
        return { kind: 'unavailable', reason: 'denied' }
      }
    },
  }
}
