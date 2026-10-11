import { describe, expect, it, vi } from 'vitest'
import { bindProfileCamera } from './profile_camera.effect.lib.ts'

/** A stream whose tracks record being stopped. */
function fakeStream() {
  let stopped = 0
  const track = {
    stop: (): void => {
      stopped += 1
    },
  }
  // A MediaStream has many members; the camera only uses getTracks (and hands the stream to the video). Cast confined to this test helper.
  const stream = { getTracks: () => [track] } as MediaStream
  return { stream, stopped: () => stopped }
}

function fakeVideo(width: number, height: number) {
  const video = document.createElement('video')
  Object.defineProperty(video, 'videoWidth', { value: width })
  Object.defineProperty(video, 'videoHeight', { value: height })
  const play = vi.spyOn(video, 'play').mockResolvedValue(undefined)
  return { video, play }
}

/** A canvas (jsdom has no 2D context) whose context records the crop it was asked to draw. */
function fakeCanvas() {
  const canvas = document.createElement('canvas')
  const draws: unknown[][] = []
  const drawImage: CanvasRenderingContext2D['drawImage'] = (...args: unknown[]) => {
    draws.push(args)
  }
  // Only drawImage is used; cast confined to this test helper.
  const context = { drawImage } as CanvasRenderingContext2D
  Object.defineProperty(canvas, 'getContext', { value: () => context })
  Object.defineProperty(canvas, 'toDataURL', { value: () => 'data:image/png;base64,SNAP' })
  return { canvas, draws }
}

describe('bindProfileCamera', () => {
  it('reports unsupported when the browser has no media devices', async () => {
    const camera = bindProfileCamera({ mediaDevices: undefined, createCanvas: () => fakeCanvas().canvas })
    expect(await camera.start()).toEqual({ kind: 'unavailable', reason: 'unsupported' })
  })

  it('reports denied when getUserMedia rejects', async () => {
    const camera = bindProfileCamera({ mediaDevices: { getUserMedia: () => Promise.reject(new Error('NotAllowedError')) }, createCanvas: () => fakeCanvas().canvas })
    expect(await camera.start()).toEqual({ kind: 'unavailable', reason: 'denied' })
  })

  it('asks for the front camera without audio, plays it, centre-crops a square snapshot, and stops every track', async () => {
    const { stream, stopped } = fakeStream()
    const getUserMedia = vi.fn(() => Promise.resolve(stream))
    const { canvas, draws } = fakeCanvas()
    const camera = bindProfileCamera({ mediaDevices: { getUserMedia }, createCanvas: () => canvas })

    const started = await camera.start()
    if (started.kind !== 'live') throw new Error('expected a live camera')
    expect(getUserMedia).toHaveBeenCalledWith({ video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 720 } }, audio: false })

    const { video, play } = fakeVideo(640, 480)
    await started.session.attach(video)
    expect(video.srcObject).toBe(stream)
    expect(play).toHaveBeenCalled()

    expect(started.session.snapshot(video)).toBe('data:image/png;base64,SNAP')
    expect(draws).toEqual([[video, 80, 0, 480, 480, 0, 0, 512, 512]])
    expect([canvas.width, canvas.height]).toEqual([512, 512])

    started.session.stop()
    expect(stopped()).toBe(1)
  })

  it('has no snapshot before the first frame arrives', async () => {
    const camera = bindProfileCamera({ mediaDevices: { getUserMedia: () => Promise.resolve(fakeStream().stream) }, createCanvas: () => fakeCanvas().canvas })
    const started = await camera.start()
    if (started.kind !== 'live') throw new Error('expected a live camera')
    expect(started.session.snapshot(fakeVideo(0, 0).video)).toBeNull()
  })
})
