import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * `gameAudio` is pure Web Audio synthesis with a tiny bit of localStorage
 * persistence — no React, no Three.js, so it's tested directly rather than
 * through any component. Every test re-imports the module fresh
 * (`vi.resetModules`) since it holds module-level singleton state (the mute
 * flag, the lazily-created `AudioContext`) that must not leak between
 * tests/assertions about "created exactly once."
 */

const STORAGE_KEY = 'equationOutbreak:audioMuted'

async function freshModule() {
  vi.resetModules()
  return import('./gameAudio')
}

class FakeGainNode {
  gain = { value: 1, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }
  connect = vi.fn(() => this)
}
class FakeOscillatorNode {
  type = 'sine'
  frequency = { value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }
  connect = vi.fn(() => new FakeGainNode())
  start = vi.fn()
  stop = vi.fn()
}
class FakeBufferSourceNode {
  buffer: unknown = null
  connect = vi.fn(() => new FakeGainNode())
  start = vi.fn()
  stop = vi.fn()
}
class FakeBiquadFilterNode {
  type = 'lowpass'
  frequency = { value: 0 }
  Q = { value: 0 }
  connect = vi.fn(() => new FakeGainNode())
}

function makeFakeAudioContext() {
  let created = 0
  const hooks = { createOscillator: () => new FakeOscillatorNode() }
  class FakeAudioContext {
    state: 'running' | 'suspended' = 'running'
    currentTime = 0
    destination = {}
    resume = vi.fn(async () => {
      this.state = 'running'
    })
    createGain = vi.fn(() => new FakeGainNode())
    createOscillator = vi.fn(() => hooks.createOscillator())
    createBufferSource = vi.fn(() => new FakeBufferSourceNode())
    createBiquadFilter = vi.fn(() => new FakeBiquadFilterNode())
    createBuffer = vi.fn((_channels: number, length: number, sampleRate: number) => ({
      sampleRate,
      getChannelData: () => new Float32Array(length),
    }))
    constructor() {
      created += 1
    }
  }
  return { FakeAudioContext, count: () => created, hooks }
}

describe('mute persistence', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('defaults to unmuted with no stored preference', async () => {
    const audio = await freshModule()
    expect(audio.isAudioMuted()).toBe(false)
  })

  it('setAudioMuted persists across a fresh module load (simulating a reload)', async () => {
    const audio = await freshModule()
    audio.setAudioMuted(true)
    expect(localStorage.getItem(STORAGE_KEY)).toBe('1')

    const reloaded = await freshModule()
    expect(reloaded.isAudioMuted()).toBe(true)
  })

  it('toggleAudioMuted flips and returns the new value', async () => {
    const audio = await freshModule()
    expect(audio.toggleAudioMuted()).toBe(true)
    expect(audio.toggleAudioMuted()).toBe(false)
    expect(audio.isAudioMuted()).toBe(false)
  })

  it('a corrupted/inaccessible localStorage does not throw and falls back to unmuted', async () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    const audio = await freshModule()
    expect(audio.isAudioMuted()).toBe(false)
    spy.mockRestore()
  })
})

describe('audio playback safety', () => {
  beforeEach(() => {
    localStorage.clear()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('play*Sound never throws when no AudioContext constructor exists (e.g. this jsdom test env)', async () => {
    const audio = await freshModule()
    expect(() => audio.playShotSound()).not.toThrow()
    expect(() => audio.playCockingBackSound()).not.toThrow()
    expect(() => audio.playCockingForwardSound()).not.toThrow()
  })

  it('play*Sound is a silent no-op while muted, even with a working AudioContext', async () => {
    const { FakeAudioContext, count } = makeFakeAudioContext()
    vi.stubGlobal('AudioContext', FakeAudioContext)
    const audio = await freshModule()
    audio.setAudioMuted(true)

    audio.playShotSound()

    // Muted must short-circuit before ever touching the AudioContext at all.
    expect(count()).toBe(0)
  })

  it('reuses a single AudioContext across multiple shots rather than creating a new one each time', async () => {
    const { FakeAudioContext, count } = makeFakeAudioContext()
    vi.stubGlobal('AudioContext', FakeAudioContext)
    const audio = await freshModule()

    audio.playShotSound()
    audio.playShotSound()
    audio.playCockingBackSound()
    audio.playCockingForwardSound()

    expect(count()).toBe(1)
  })

  it('a synthesis error inside one call is swallowed and does not propagate', async () => {
    const { FakeAudioContext, hooks } = makeFakeAudioContext()
    hooks.createOscillator = () => {
      throw new Error('synthesis boom')
    }
    vi.stubGlobal('AudioContext', FakeAudioContext)
    const audio = await freshModule()

    expect(() => audio.playCockingBackSound()).not.toThrow()
  })
})
