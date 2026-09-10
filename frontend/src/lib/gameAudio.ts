/**
 * Centralized Web Audio system for Equation Outbreak. Every cue (the
 * Equation Blaster's shot/reload, each zombie character's spawn groan)
 * plays a real recorded `.wav` file, decoded once into an `AudioBuffer` and
 * cached under `playSoundEffect` — a missing or slow-to-decode file
 * degrades to silence rather than an error.
 *
 * A single `AudioContext` is created lazily on first use and reused for
 * the lifetime of the page — browsers require a user gesture before audio
 * can actually start, which every caller here already has (a shot, a
 * reload, and a wave spawning its zombies are all direct results of the
 * player's own click). Loading of every `.wav` file is kicked off
 * explicitly via `preloadWeaponAudio`/`preloadZombieAudio` from the same
 * gesture that starts a session, well before the first shot or the first
 * wave's spawn can actually happen — decoding an `ArrayBuffer` isn't
 * instant, and the very first cue of a session shouldn't have a chance of
 * being silent while it's still loading.
 */

const MUTE_STORAGE_KEY = 'equationOutbreak:audioMuted'

const SHOT_SOUND_URL = '/audio/equation-outbreak/weapons/blaster-shot-01.wav'
const RELOAD_SOUND_URL = '/audio/equation-outbreak/weapons/blaster-reload-01.wav'

function readMutedPreference(): boolean {
  try {
    return window.localStorage.getItem(MUTE_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function writeMutedPreference(value: boolean): void {
  try {
    window.localStorage.setItem(MUTE_STORAGE_KEY, value ? '1' : '0')
  } catch {
    // Storage can throw (private browsing, quota) — losing the preference
    // across reloads is fine; audio must never fail because of this.
  }
}

let muted = readMutedPreference()
let audioContext: AudioContext | null = null

/** Decoded buffers, keyed by URL — populated by `preloadWeaponAudio`
 * (and, as a fallback, lazily by `playBufferedSound` itself if a sound is
 * ever played before preloading ran). A play call that lands before its
 * buffer has finished decoding is a silent no-op rather than a queued or
 * blocking wait — never worth stalling gameplay audio for. */
const bufferCache = new Map<string, AudioBuffer>()
const pendingLoads = new Set<string>()

export function isAudioMuted(): boolean {
  return muted
}

export function setAudioMuted(value: boolean): void {
  muted = value
  writeMutedPreference(value)
}

export function toggleAudioMuted(): boolean {
  setAudioMuted(!muted)
  return muted
}

/** Runs `fn`, swallowing any error — a missing file, a decode failure, or
 * an unsupported node type must never take gameplay down with it. */
function safely(fn: () => void): void {
  try {
    fn()
  } catch {
    // Audio must never break gameplay.
  }
}

/** Lazily creates (once) and resumes the shared AudioContext. Never
 * creates a second one — every caller goes through this. */
function getAudioContext(): AudioContext | null {
  try {
    if (!audioContext) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctor) return null
      audioContext = new Ctor()
    }
    if (audioContext.state === 'suspended') {
      audioContext.resume().catch(() => {})
    }
    return audioContext
  } catch {
    return null
  }
}

function loadBuffer(ctx: AudioContext, url: string): void {
  if (bufferCache.has(url) || pendingLoads.has(url)) return
  pendingLoads.add(url)
  fetch(url)
    .then((res) => {
      if (!res.ok) throw new Error(`fetch ${url} -> ${res.status}`)
      return res.arrayBuffer()
    })
    .then((data) => ctx.decodeAudioData(data))
    .then((decoded) => {
      bufferCache.set(url, decoded)
    })
    .catch(() => {
      // A missing/corrupt/undecodable file just means this cue stays
      // silent — never worth breaking gameplay over.
    })
    .finally(() => {
      pendingLoads.delete(url)
    })
}

/** Kicks off decoding both weapon `.wav` files — call this once from the
 * same user-gesture handler that starts a session (well before the intro
 * beat ends and the first shot becomes possible), not from inside the
 * play functions themselves, so decode latency never risks a silent first
 * shot. Safe to call more than once; `loadBuffer` no-ops once a load is
 * cached or already in flight. */
export function preloadWeaponAudio(): void {
  safely(() => {
    const ctx = getAudioContext()
    if (!ctx) return
    loadBuffer(ctx, SHOT_SOUND_URL)
    loadBuffer(ctx, RELOAD_SOUND_URL)
  })
}

/** Same idea as `preloadWeaponAudio`, for the session roster's groan
 * files — call once per `urls` set from the same start-session gesture,
 * before the first wave's zombies actually spawn. */
export function preloadZombieAudio(urls: string[]): void {
  safely(() => {
    const ctx = getAudioContext()
    if (!ctx) return
    for (const url of urls) loadBuffer(ctx, url)
  })
}

/** Plays an already-decoded buffer through its own gain node. Also kicks
 * off loading if it hasn't happened yet (e.g. the relevant `preload*`
 * function was never called, or this is a genuinely new cue) — that call
 * will just be silent this time and ready for the next one. Exported
 * directly (not just through the `play*Sound` wrappers below) so a future
 * cue can reuse the same load/cache/mute plumbing without adding another
 * near-identical wrapper here. */
export function playSoundEffect(url: string, gain = 0.7): void {
  if (muted) return
  safely(() => {
    const ctx = getAudioContext()
    if (!ctx) return
    loadBuffer(ctx, url)
    const buffer = bufferCache.get(url)
    if (!buffer) return
    const source = ctx.createBufferSource()
    source.buffer = buffer
    const gainNode = ctx.createGain()
    gainNode.gain.value = gain
    source.connect(gainNode).connect(ctx.destination)
    source.start(ctx.currentTime)
  })
}

/** The Equation Blaster's shot sound. */
export function playShotSound(): void {
  playSoundEffect(SHOT_SOUND_URL, 0.7)
}

/** The Equation Blaster's reload sound — one continuous clip covering the
 * whole cocking motion, played once when the reload actually starts (see
 * `EquationBlaster.tsx`, after the shot's own recoil has settled), not
 * split into separate "back"/"forward" cues the way the old procedural
 * version was. */
export function playReloadSound(): void {
  playSoundEffect(RELOAD_SOUND_URL, 0.7)
}

/** A zombie character's spawn groan (`CharacterDefinition.groanSoundUrl`).
 * Quieter than the weapon cues by default since up to four of these can
 * play back to back at once when a wave's carriers all spawn together. */
export function playZombieGroan(url: string): void {
  playSoundEffect(url, 0.45)
}
