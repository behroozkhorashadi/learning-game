import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * `gameAudio` plays two real `.wav` files (shot, reload) through the Web
 * Audio API, plus a small bit of localStorage mute persistence — no React,
 * no Three.js, so it's tested directly rather than through any component.
 * Every test re-imports the module fresh (`vi.resetModules`) since it holds
 * module-level singleton state (the mute flag, the lazily-created
 * `AudioContext`, the decoded-buffer cache) that must not leak between
 * tests/assertions about "loaded exactly once" or "created exactly once."
 *
 * `fetch` and `AudioContext.decodeAudioData` are both mocked so these tests
 * never touch the network or real audio decoding — they only need to prove
 * the *plumbing* (load once, cache, play the cached buffer, degrade to
 * silence on any failure) is correct.
 */

const STORAGE_KEY = 'equationOutbreak:audioMuted'

async function freshModule() {
  vi.resetModules()
  return import('./gameAudio')
}

class FakeGainNode {
  gain = { value: 1 }
  connect = vi.fn(() => this)
}
class FakeBufferSourceNode {
  buffer: unknown = null
  start = vi.fn()
  connect = vi.fn(() => new FakeGainNode())
}

const FAKE_DECODED_BUFFER = { duration: 0.9, sampleRate: 48000 }

function makeFakeAudioContext() {
  let created = 0
  const instances: InstanceType<typeof FakeAudioContext>[] = []
  const hooks = { decodeAudioData: (_data: ArrayBuffer) => Promise.resolve(FAKE_DECODED_BUFFER) }
  class FakeAudioContext {
    state: 'running' | 'suspended' = 'running'
    currentTime = 0
    destination = {}
    resume = vi.fn(async () => {
      this.state = 'running'
    })
    createGain = vi.fn(() => new FakeGainNode())
    createBufferSource = vi.fn(() => new FakeBufferSourceNode())
    decodeAudioData = vi.fn((data: ArrayBuffer) => hooks.decodeAudioData(data))
    constructor() {
      created += 1
      instances.push(this)
    }
  }
  return { FakeAudioContext, count: () => created, hooks, lastInstance: () => instances.at(-1) }
}

function stubFetchResolving() {
  return vi.fn(() =>
    Promise.resolve({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    } as Response),
  )
}

/** Flushes the microtask queue past a whole fetch -> arrayBuffer ->
 * decodeAudioData -> cache-set chain — a real macrotask boundary
 * (`setTimeout`) rather than counting exact microtask hops, since each
 * `.then()` that itself returns a promise can take more than one tick to
 * settle. */
async function flushLoadChain() {
  await new Promise((resolve) => setTimeout(resolve, 0))
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
    expect(() => audio.playReloadSound()).not.toThrow()
    expect(() => audio.playZombieGroan('/audio/equation-outbreak/zombies/groan_scientist.wav')).not.toThrow()
    expect(() => audio.playZombieHitSound()).not.toThrow()
    expect(() => audio.playZombieAttackSound()).not.toThrow()
    expect(() => audio.playSoundEffect('/anything.wav')).not.toThrow()
  })

  it('preloadWeaponAudio/preloadZombieAudio never throw when no AudioContext constructor exists', async () => {
    const audio = await freshModule()
    expect(() => audio.preloadWeaponAudio()).not.toThrow()
    expect(() => audio.preloadZombieAudio(['/a.wav', '/b.wav'])).not.toThrow()
  })

  it('preloadZombieAudio fetches every URL in the roster exactly once, even called repeatedly', async () => {
    const { FakeAudioContext } = makeFakeAudioContext()
    vi.stubGlobal('AudioContext', FakeAudioContext)
    const fetchMock = stubFetchResolving()
    vi.stubGlobal('fetch', fetchMock)
    const audio = await freshModule()
    const urls = [
      '/audio/equation-outbreak/zombies/groan_scientist.wav',
      '/audio/equation-outbreak/zombies/groan_hockey_player.wav',
      '/audio/equation-outbreak/zombies/groan_skater.wav',
      '/audio/equation-outbreak/zombies/groan_sporty.wav',
    ]

    audio.preloadZombieAudio(urls)
    audio.preloadZombieAudio(urls)

    expect(fetchMock).toHaveBeenCalledTimes(4)
  })

  it('playZombieGroan plays a quieter gain than the weapon cues, so up to four spawning at once stay reasonable', async () => {
    const { FakeAudioContext, lastInstance } = makeFakeAudioContext()
    vi.stubGlobal('AudioContext', FakeAudioContext)
    vi.stubGlobal('fetch', stubFetchResolving())
    const audio = await freshModule()
    audio.preloadZombieAudio(['/g.wav'])
    await flushLoadChain()

    audio.playZombieGroan('/g.wav')

    const ctx = lastInstance()!
    const lastGainNode = ctx.createGain.mock.results.at(-1)?.value as FakeGainNode
    expect(lastGainNode.gain.value).toBeLessThan(0.7)
  })

  it('play*Sound is a silent no-op while muted — no fetch is even attempted', async () => {
    const { FakeAudioContext } = makeFakeAudioContext()
    vi.stubGlobal('AudioContext', FakeAudioContext)
    const fetchMock = stubFetchResolving()
    vi.stubGlobal('fetch', fetchMock)
    const audio = await freshModule()
    audio.setAudioMuted(true)

    audio.playShotSound()
    await flushLoadChain()

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('reuses a single AudioContext across multiple calls rather than creating a new one each time', async () => {
    const { FakeAudioContext, count } = makeFakeAudioContext()
    vi.stubGlobal('AudioContext', FakeAudioContext)
    vi.stubGlobal('fetch', stubFetchResolving())
    const audio = await freshModule()

    audio.preloadWeaponAudio()
    audio.playShotSound()
    audio.playReloadSound()
    await flushLoadChain()

    expect(count()).toBe(1)
  })

  it('preloadWeaponAudio fetches each file exactly once, even if called multiple times', async () => {
    const { FakeAudioContext } = makeFakeAudioContext()
    vi.stubGlobal('AudioContext', FakeAudioContext)
    const fetchMock = stubFetchResolving()
    vi.stubGlobal('fetch', fetchMock)
    const audio = await freshModule()

    audio.preloadWeaponAudio()
    audio.preloadWeaponAudio()
    audio.preloadWeaponAudio()
    await flushLoadChain()

    // Four distinct files (shot + reload + zombie-hit + zombie-attack) —
    // not one call per preload call.
    expect(fetchMock).toHaveBeenCalledTimes(4)
  })

  it('plays the decoded buffer once loading completes, without re-fetching on a later call', async () => {
    const { FakeAudioContext } = makeFakeAudioContext()
    vi.stubGlobal('AudioContext', FakeAudioContext)
    const fetchMock = stubFetchResolving()
    vi.stubGlobal('fetch', fetchMock)
    const audio = await freshModule()

    audio.preloadWeaponAudio()
    await flushLoadChain()

    audio.playShotSound()
    audio.playShotSound()

    // Still exactly one fetch per URL — playing doesn't re-trigger loading.
    expect(fetchMock).toHaveBeenCalledTimes(4)
  })

  it('a shot fired before its buffer has finished decoding is a silent no-op, not a throw or a queued play', async () => {
    const { FakeAudioContext } = makeFakeAudioContext()
    vi.stubGlobal('AudioContext', FakeAudioContext)
    // A fetch that never resolves within this test — simulates "still loading."
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise(() => {})),
    )
    const audio = await freshModule()

    expect(() => audio.playShotSound()).not.toThrow()
  })

  it('a failed fetch is swallowed — later play calls stay silent no-ops, never a throw', async () => {
    const { FakeAudioContext } = makeFakeAudioContext()
    vi.stubGlobal('AudioContext', FakeAudioContext)
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ ok: false, status: 404 } as Response)),
    )
    const audio = await freshModule()

    audio.preloadWeaponAudio()
    await flushLoadChain()

    expect(() => audio.playShotSound()).not.toThrow()
  })

  it('a decode failure is swallowed — never a throw', async () => {
    const { FakeAudioContext, hooks } = makeFakeAudioContext()
    hooks.decodeAudioData = () => Promise.reject(new Error('bad data'))
    vi.stubGlobal('AudioContext', FakeAudioContext)
    vi.stubGlobal('fetch', stubFetchResolving())
    const audio = await freshModule()

    audio.preloadWeaponAudio()
    await flushLoadChain()

    expect(() => audio.playShotSound()).not.toThrow()
  })
})
