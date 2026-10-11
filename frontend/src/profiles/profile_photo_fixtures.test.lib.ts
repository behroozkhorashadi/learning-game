import type { CameraUnavailable, PhotoRemixRequest, ProfileCamera, SavedPhoto } from './profile_photo_state.pure.lib.ts'

/** Shared test/story fakes for the photo panel: a camera, a remix service, saved pictures. */

/** A distinct, real (renderable) picture per colour, so stories show something and tests can tell versions apart. */
export function picture(color: string): string {
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="${color}"/></svg>`)}`
}

export const PHOTO = picture('#f4b400')

export interface FakeCamera extends ProfileCamera {
  /** How many sessions have been stopped. */
  readonly stops: () => number
}

/** A camera that opens (or reports `unavailable`) immediately and whose every snapshot is `PHOTO`. */
export function fakeCamera(outcome: 'live' | CameraUnavailable = 'live'): FakeCamera {
  let stops = 0
  return {
    start: () =>
      Promise.resolve(
        outcome === 'live'
          ? {
              kind: 'live',
              session: {
                attach: () => Promise.resolve(),
                snapshot: () => PHOTO,
                stop: () => {
                  stops += 1
                },
              },
            }
          : { kind: 'unavailable', reason: outcome },
      ),
    stops: () => stops,
  }
}

export interface FakeRemix {
  readonly remixPhoto: (request: PhotoRemixRequest) => Promise<string>
  readonly requests: readonly PhotoRemixRequest[]
}

/** Each remix succeeds with a new picture (`remixed(1)`, `remixed(2)`, …), or every remix fails with `failWith`. */
export function fakeRemix(failWith: string | null = null): FakeRemix {
  const requests: PhotoRemixRequest[] = []
  return {
    requests,
    remixPhoto: (request) => {
      requests.push(request)
      return failWith === null ? Promise.resolve(remixed(requests.length)) : Promise.reject(new Error(failWith))
    },
  }
}

export function remixed(n: number): string {
  return picture(['#4285f4', '#db4437', '#0f9d58', '#ab47bc'][n % 4] ?? '#000')
}

export const SAVED: readonly SavedPhoto[] = [
  { id: 1, url: picture('#8d6e63'), label: 'Photo', created_at: '2026-10-01T00:00:00' },
  { id: 2, url: picture('#26a69a'), label: 'Space explorer', created_at: '2026-10-01T00:00:00' },
]
