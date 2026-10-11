import { describe, expect, it } from 'vitest'
import {
  GAMEPLAY_MUSIC_URL,
  MUTE_STORAGE_KEY,
  RELOAD_SOUND_URL,
  SHOT_SOUND_URL,
  ZOMBIE_ATTACK_SOUND_URL,
  ZOMBIE_HIT_SOUND_URL,
  bindGameAudio,
  type AudioGainNode,
  type AudioOutNode,
  type AudioSourceNode,
  type GameAudioContext,
  type GameAudioDeps,
} from './game_audio.effect.lib.ts'

/**
 * The audio plumbing over a fake Web Audio context and a fake file loader:
 * each file loads once, decoded buffers are cached and played, mute persists,
 * and every failure (no context, a missing file, a bad decode, blocked
 * storage) degrades to silence, never a throw.
 */

// A decoded buffer is only ever passed back to a source node; the fake needs no members. Cast confined to this test helper.
const DECODED = {} as AudioBuffer

interface Played {
  readonly gain: number
  readonly loop: boolean
  stopped: boolean
}

function fakeContext(decode: (data: ArrayBuffer) => Promise<AudioBuffer> = () => Promise.resolve(DECODED)) {
  const played: Played[] = []
  const gains: AudioGainNode[] = []
  const destination: AudioOutNode = { connect: (node) => node }
  const context: GameAudioContext = {
    state: 'running',
    currentTime: 0,
    destination,
    resume: () => Promise.resolve(),
    createGain: (): AudioGainNode => {
      const node: AudioGainNode = { gain: { value: 1 }, connect: (next) => next }
      gains.push(node)
      return node
    },
    createBufferSource: (): AudioSourceNode => {
      let connectedGain: AudioGainNode | null = null
      const source: AudioSourceNode = {
        buffer: null,
        loop: false,
        connect: (node) => {
          connectedGain = gains.find((g) => g === node) ?? connectedGain
          return node
        },
        start: () => {
          const entry: Played = { gain: connectedGain?.gain.value ?? 1, loop: source.loop, stopped: false }
          played.push(entry)
          source.stop = () => {
            entry.stopped = true
          }
        },
        stop: () => undefined,
        disconnect: () => undefined,
      }
      return source
    },
    decodeAudioData: decode,
  }
  return { context, played }
}

interface Setup {
  readonly context?: GameAudioContext | null
  readonly load?: GameAudioDeps['loadArrayBuffer']
  readonly stored?: Map<string, string>
  readonly storageThrows?: boolean
}

function audioOver({ context = fakeContext().context, load, stored = new Map<string, string>(), storageThrows = false }: Setup = {}) {
  const loads: string[] = []
  let contextsOpened = 0
  const audio = bindGameAudio({
    openAudioContext: () => {
      contextsOpened += 1
      return context
    },
    loadArrayBuffer:
      load ??
      ((url) => {
        loads.push(url)
        return Promise.resolve(new ArrayBuffer(8))
      }),
    storage: {
      getItem: (key) => {
        if (storageThrows) throw new Error('blocked')
        return stored.get(key) ?? null
      },
      setItem: (key, value) => {
        if (storageThrows) throw new Error('blocked')
        stored.set(key, value)
      },
    },
  })
  return { audio, loads, stored, contextsOpened: () => contextsOpened }
}

/** Past a whole load → decode → cache chain (a handful of promise hops). */
async function settle(): Promise<void> {
  for (let i = 0; i < 10; i++) await Promise.resolve()
}

describe('mute', () => {
  it('starts unmuted with no stored preference, and persists the toggle', () => {
    const stored = new Map<string, string>()
    const { audio } = audioOver({ stored })
    expect(audio.isMuted()).toBe(false)
    expect(audio.toggleMuted()).toBe(true)
    expect(stored.get(MUTE_STORAGE_KEY)).toBe('1')
    expect(audioOver({ stored }).audio.isMuted()).toBe(true)
    expect(audio.toggleMuted()).toBe(false)
    expect(stored.get(MUTE_STORAGE_KEY)).toBe('0')
  })

  it('blocked storage neither throws nor mutes', () => {
    const { audio } = audioOver({ storageThrows: true })
    expect(audio.isMuted()).toBe(false)
    expect(audio.toggleMuted()).toBe(true)
  })

  it('a muted cue loads nothing and plays nothing', async () => {
    const { context, played } = fakeContext()
    const { audio, loads } = audioOver({ context })
    audio.toggleMuted()
    audio.playShot()
    await settle()
    expect(loads).toEqual([])
    expect(played).toEqual([])
  })
})

describe('loading and playing', () => {
  it('preloads the weapon cues once each, however often it is asked', async () => {
    const { audio, loads } = audioOver()
    audio.preloadWeapon()
    audio.preloadWeapon()
    await settle()
    audio.preloadWeapon()
    expect([...loads].sort()).toEqual([RELOAD_SOUND_URL, SHOT_SOUND_URL, ZOMBIE_ATTACK_SOUND_URL, ZOMBIE_HIT_SOUND_URL].sort())
  })

  it('preloads every roster groan once', () => {
    const { audio, loads } = audioOver()
    audio.preloadZombies(['/a.wav', '/b.wav'])
    audio.preloadZombies(['/a.wav', '/b.wav'])
    expect(loads).toEqual(['/a.wav', '/b.wav'])
  })

  it('opens one audio context for everything', async () => {
    const harness = audioOver()
    harness.audio.preloadWeapon()
    harness.audio.playShot()
    harness.audio.playReload()
    await settle()
    harness.audio.playShot()
    expect(harness.contextsOpened()).toBe(1)
  })

  it('a cue played before its file has decoded is silent, and plays once it has', async () => {
    const { context, played } = fakeContext()
    const { audio, loads } = audioOver({ context })
    audio.playShot()
    expect(played).toEqual([])
    await settle()
    audio.playShot()
    expect(played.map((p) => p.gain)).toEqual([0.4])
    expect(loads).toEqual([SHOT_SOUND_URL])
  })

  it('groans are quieter than the weapon, so four at once stay reasonable', async () => {
    const { context, played } = fakeContext()
    const { audio } = audioOver({ context })
    audio.preloadZombies(['/g.wav'])
    audio.preloadWeapon()
    await settle()
    audio.playGroan('/g.wav')
    audio.playReload()
    const [groan, reload] = played
    expect(groan?.gain).toBeLessThan(reload?.gain ?? 0)
  })
})

describe('music', () => {
  it('loops at its volume, does not restart while playing, and stops', async () => {
    const { context, played } = fakeContext()
    const { audio } = audioOver({ context })
    audio.preloadMusic()
    await settle()
    audio.startMusic()
    audio.startMusic()
    expect(played).toEqual([{ gain: 0.35, loop: true, stopped: false }])
    audio.stopMusic()
    expect(played[0]?.stopped).toBe(true)
    audio.startMusic()
    expect(played).toHaveLength(2)
  })

  it('is a silent no-op until its file has decoded', () => {
    const { context, played } = fakeContext()
    const { audio, loads } = audioOver({ context })
    audio.startMusic()
    expect(played).toEqual([])
    expect(loads).toEqual([GAMEPLAY_MUSIC_URL])
  })
})

describe('failures stay silent', () => {
  it('with no audio context at all', () => {
    const { audio } = audioOver({ context: null })
    expect(() => {
      audio.preloadWeapon()
      audio.preloadZombies(['/a.wav'])
      audio.playShot()
      audio.playGroan('/a.wav')
      audio.startMusic()
      audio.stopMusic()
    }).not.toThrow()
  })

  it('for a missing file or a bad decode', async () => {
    const missing = audioOver({ load: () => Promise.reject(new Error('404')) })
    missing.audio.preloadWeapon()
    await settle()
    expect(() => {
      missing.audio.playShot()
    }).not.toThrow()

    const { context, played } = fakeContext(() => Promise.reject(new Error('bad data')))
    const bad = audioOver({ context })
    bad.audio.preloadWeapon()
    await settle()
    bad.audio.playShot()
    expect(played).toEqual([])
  })
})
