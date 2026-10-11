import type { ArenaAudio } from './zombie_arena_state.pure.lib.ts'

/**
 * Web Audio for Equation Outbreak. Every one-shot cue (the blaster's shot and
 * reload, each zombie's spawn groan, the body-shot impact, the attack) plays a
 * recorded `.wav`, decoded once into an AudioBuffer and cached; a missing or
 * slow-to-decode file degrades to silence, never an error. The gameplay music
 * bed is the one long-running sound: a single looping source through its own
 * gain node.
 *
 * One AudioContext, created lazily on first use and reused. Browsers need a
 * user gesture before audio can start, which every caller has (a shot, a
 * reload, a wave spawning, a session starting). Decoding is started by the
 * `preload*` calls from the same Start gesture, well before the first shot,
 * spawn, or music, so the first cue of a session isn't silent while it loads.
 */

export const MUTE_STORAGE_KEY = 'equationOutbreak:audioMuted'

export const SHOT_SOUND_URL = '/audio/equation-outbreak/weapons/blaster-shot-01.wav'
export const RELOAD_SOUND_URL = '/audio/equation-outbreak/weapons/blaster-reload-01.wav'
export const ZOMBIE_HIT_SOUND_URL = '/audio/equation-outbreak/zombies/zombie-hit.wav'
export const ZOMBIE_ATTACK_SOUND_URL = '/audio/equation-outbreak/zombies/zombie-attack.wav'
export const GAMEPLAY_MUSIC_URL = '/audio/equation-outbreak/music/gameplay_music.wav'
const GAMEPLAY_MUSIC_VOLUME = 0.35

/** The slice of Web Audio the game uses: the real AudioContext and its nodes fit these. */
export interface AudioOutNode {
  connect(destination: AudioOutNode): AudioOutNode
}

export interface AudioGainNode extends AudioOutNode {
  readonly gain: { value: number }
}

export interface AudioSourceNode extends AudioOutNode {
  buffer: AudioBuffer | null
  loop: boolean
  start(when?: number): void
  stop(): void
  disconnect(): void
}

export interface GameAudioContext {
  readonly state: AudioContextState
  readonly currentTime: number
  readonly destination: AudioOutNode
  resume(): Promise<void>
  createGain(): AudioGainNode
  createBufferSource(): AudioSourceNode
  decodeAudioData(data: ArrayBuffer): Promise<AudioBuffer>
}

export interface GameAudioDeps {
  /** A new AudioContext, or null where the browser has none. Called at most once. */
  readonly openAudioContext: () => GameAudioContext | null
  /** An audio file's bytes; rejects for a missing file. */
  readonly loadArrayBuffer: (url: string) => Promise<ArrayBuffer>
  /** Where the mute preference persists. Either call may throw (private browsing, quota); losing the preference is fine. */
  readonly storage: { readonly getItem: (key: string) => string | null; readonly setItem: (key: string, value: string) => void }
}

/** Runs `run`, swallowing any error: a missing file, a decode failure, or an unsupported node type must never take gameplay down. */
function safely(run: () => void): void {
  try {
    run()
  } catch {
    // Audio must never break gameplay.
  }
}

export function bindGameAudio({ openAudioContext, loadArrayBuffer, storage }: GameAudioDeps): ArenaAudio {
  let muted = false
  try {
    muted = storage.getItem(MUTE_STORAGE_KEY) === '1'
  } catch {
    muted = false
  }
  let context: GameAudioContext | null = null
  let contextTried = false
  /** The playing music loop, or null between rounds: so `startMusic` no-ops mid-round instead of restarting, and mute can reach it live. */
  let musicSource: AudioSourceNode | null = null
  let musicGain: AudioGainNode | null = null
  /** Decoded buffers by URL. A play before its buffer has decoded is a silent no-op, never a queued or blocking wait. */
  const buffers = new Map<string, AudioBuffer>()
  const loading = new Set<string>()

  /** The shared context, created once and resumed if the browser suspended it. */
  function audioContext(): GameAudioContext | null {
    if (!contextTried) {
      contextTried = true
      try {
        context = openAudioContext()
      } catch {
        context = null
      }
    }
    if (context?.state === 'suspended') context.resume().catch(() => undefined)
    return context
  }

  function load(ctx: GameAudioContext, url: string): void {
    if (buffers.has(url) || loading.has(url)) return
    loading.add(url)
    loadArrayBuffer(url)
      .then((data) => ctx.decodeAudioData(data))
      .then((decoded) => {
        buffers.set(url, decoded)
      })
      .catch(() => {
        // A missing, corrupt, or undecodable file just leaves this cue silent.
      })
      .finally(() => {
        loading.delete(url)
      })
  }

  function preload(urls: readonly string[]): void {
    safely(() => {
      const ctx = audioContext()
      if (ctx === null) return
      for (const url of urls) load(ctx, url)
    })
  }

  /** Plays a decoded buffer through its own gain; starts loading it if nothing has yet (that play is silent, the next one isn't). */
  function playEffect(url: string, gain: number): void {
    if (muted) return
    safely(() => {
      const ctx = audioContext()
      if (ctx === null) return
      load(ctx, url)
      const buffer = buffers.get(url)
      if (buffer === undefined) return
      const source = ctx.createBufferSource()
      source.buffer = buffer
      const gainNode = ctx.createGain()
      gainNode.gain.value = gain
      source.connect(gainNode).connect(ctx.destination)
      source.start(ctx.currentTime)
    })
  }

  function setMuted(value: boolean): void {
    muted = value
    try {
      storage.setItem(MUTE_STORAGE_KEY, value ? '1' : '0')
    } catch {
      // Losing the preference across reloads is fine; audio must not fail over it.
    }
    // One-shot cues check `muted` when they fire; the music loop is long-running, so it changes live.
    if (musicGain) musicGain.gain.value = value ? 0 : GAMEPLAY_MUSIC_VOLUME
  }

  return {
    isMuted: () => muted,
    toggleMuted: () => {
      setMuted(!muted)
      return muted
    },
    preloadWeapon: () => {
      preload([SHOT_SOUND_URL, RELOAD_SOUND_URL, ZOMBIE_HIT_SOUND_URL, ZOMBIE_ATTACK_SOUND_URL])
    },
    preloadZombies: preload,
    preloadMusic: () => {
      preload([GAMEPLAY_MUSIC_URL])
    },
    startMusic: () => {
      if (musicSource) return
      safely(() => {
        const ctx = audioContext()
        if (ctx === null) return
        load(ctx, GAMEPLAY_MUSIC_URL)
        // Not decoded yet: a silent no-op; the next phase change in the round retries.
        const buffer = buffers.get(GAMEPLAY_MUSIC_URL)
        if (buffer === undefined) return
        const source = ctx.createBufferSource()
        source.buffer = buffer
        source.loop = true
        const gain = ctx.createGain()
        gain.gain.value = muted ? 0 : GAMEPLAY_MUSIC_VOLUME
        source.connect(gain).connect(ctx.destination)
        source.start(ctx.currentTime)
        musicSource = source
        musicGain = gain
      })
    },
    stopMusic: () => {
      const source = musicSource
      safely(() => {
        source?.stop()
        source?.disconnect()
      })
      musicSource = null
      musicGain = null
    },
    playShot: () => {
      playEffect(SHOT_SOUND_URL, 0.4)
    },
    // One continuous clip for the whole cocking motion, played once as the reload starts (after the shot's recoil).
    playReload: () => {
      playEffect(RELOAD_SOUND_URL, 0.7)
    },
    // Quieter than the weapon: up to four play back to back when a wave spawns.
    playGroan: (url) => {
      playEffect(url, 0.45)
    },
    // A physical "that hit" cue for body shots only (the arena gates it), independent of whether the answer was right.
    playZombieHit: () => {
      playEffect(ZOMBIE_HIT_SOUND_URL, 0.9)
    },
    playZombieAttack: () => {
      playEffect(ZOMBIE_ATTACK_SOUND_URL, 0.7)
    },
  }
}
