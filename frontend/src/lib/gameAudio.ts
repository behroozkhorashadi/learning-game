/**
 * Centralized Web Audio system for Equation Outbreak. Every one-shot cue
 * (the Equation Blaster's shot/reload, each zombie character's spawn
 * groan, the body-shot impact) plays a real recorded `.wav` file, decoded
 * once into an `AudioBuffer` and cached under `playSoundEffect` — a
 * missing or slow-to-decode file degrades to silence rather than an
 * error. The gameplay music bed is the one long-running exception —
 * `startGameplayMusic`/`stopGameplayMusic` manage a single looping
 * `AudioBufferSourceNode` through its own gain node instead.
 *
 * A single `AudioContext` is created lazily on first use and reused for
 * the lifetime of the page — browsers require a user gesture before audio
 * can actually start, which every caller here already has (a shot, a
 * reload, a wave spawning its zombies, and starting a session's music are
 * all direct results of the player's own click). Loading of every `.wav`
 * file is kicked off explicitly via `preloadWeaponAudio`/
 * `preloadZombieAudio`/`preloadGameplayMusic` from the same gesture that
 * starts a session, well before the first shot, the first wave's spawn, or
 * the music itself can actually happen — decoding an `ArrayBuffer` isn't
 * instant, and the very first cue of a session shouldn't have a chance of
 * being silent while it's still loading.
 */

const MUTE_STORAGE_KEY = 'equationOutbreak:audioMuted'

const SHOT_SOUND_URL = '/audio/equation-outbreak/weapons/blaster-shot-01.wav'
const RELOAD_SOUND_URL = '/audio/equation-outbreak/weapons/blaster-reload-01.wav'
const ZOMBIE_HIT_SOUND_URL = '/audio/equation-outbreak/zombies/zombie-hit.wav'
const ZOMBIE_ATTACK_SOUND_URL = '/audio/equation-outbreak/zombies/zombie-attack.wav'
const GAMEPLAY_MUSIC_URL = '/audio/equation-outbreak/music/gameplay_music.wav'
const GAMEPLAY_MUSIC_VOLUME = 0.35

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

/** The currently-playing gameplay-music loop, if any — `null` whenever no
 * round is in progress. Tracked so `startGameplayMusic` can no-op instead
 * of restarting the loop from the beginning on every wave transition, and
 * so `stopGameplayMusic`/mute-toggling has something to act on. */
let musicSource: AudioBufferSourceNode | null = null
let musicGain: GainNode | null = null

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
  // One-shot cues (shots, groans, reload) just check `muted` at the instant
  // they're triggered — fine, since they're instant. The gameplay music
  // loop is long-running, so toggling mute needs to affect it live rather
  // than only the *next* time it happens to (re)start.
  if (musicGain) {
    musicGain.gain.value = value ? 0 : GAMEPLAY_MUSIC_VOLUME
  }
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

/** Kicks off decoding every shot-related `.wav` file (the weapon's own shot
 * and reload, plus the shared body-shot impact and zombie-attack cues) —
 * call this once from the same user-gesture handler that starts a session
 * (well before the intro beat ends and the first shot becomes possible),
 * not from inside the play functions themselves, so decode latency never
 * risks a silent first shot. Safe to call more than once; `loadBuffer`
 * no-ops once a load is cached or already in flight. */
export function preloadWeaponAudio(): void {
  safely(() => {
    const ctx = getAudioContext()
    if (!ctx) return
    loadBuffer(ctx, SHOT_SOUND_URL)
    loadBuffer(ctx, RELOAD_SOUND_URL)
    loadBuffer(ctx, ZOMBIE_HIT_SOUND_URL)
    loadBuffer(ctx, ZOMBIE_ATTACK_SOUND_URL)
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
  playSoundEffect(SHOT_SOUND_URL, 0.4)
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

/** The impact cue for a landed *body* shot — deliberately not played for a
 * headshot (see `ZombieMathBlaster.tsx`'s hit-feedback effect, which gates
 * this on `wave.lastHit.zone === 'body'`), and independent of whether the
 * shot was correct or wrong: it's a physical "that hit" cue, not an
 * answer-correctness one — the separate correct/wrong feedback already
 * covers that. */
export function playZombieHitSound(): void {
  playSoundEffect(ZOMBIE_HIT_SOUND_URL, 0.9)
}

/** Plays when a zombie reaches the player and swipes at them (`resolutionReason
 * === 'player_contact'` — see `ZombieMathBlaster.tsx`), alongside the
 * existing strong screen-shake/vignette feedback for that same event. */
export function playZombieAttackSound(): void {
  playSoundEffect(ZOMBIE_ATTACK_SOUND_URL, 0.7)
}

/** Kicks off decoding the gameplay music loop — call once from the
 * start-session gesture, same reasoning as `preloadWeaponAudio`. */
export function preloadGameplayMusic(): void {
  safely(() => {
    const ctx = getAudioContext()
    if (!ctx) return
    loadBuffer(ctx, GAMEPLAY_MUSIC_URL)
  })
}

/**
 * Starts the looping gameplay-music bed if it isn't already playing.
 * Deliberately idempotent — `ZombieMathBlaster.tsx` calls this on every
 * phase change for as long as a round is in progress (so the music
 * survives each wave transition, per that component's own docstring),
 * and this must never restart the loop from the beginning on those calls,
 * only on a genuinely new round after `stopGameplayMusic`.
 *
 * If the buffer hasn't finished decoding yet, this is a silent no-op —
 * the next phase change within the round will retry, and by then it's
 * almost certainly ready (decoding started at session-start, well before
 * the first wave).
 */
export function startGameplayMusic(): void {
  if (musicSource) return
  safely(() => {
    const ctx = getAudioContext()
    if (!ctx) return
    loadBuffer(ctx, GAMEPLAY_MUSIC_URL)
    const buffer = bufferCache.get(GAMEPLAY_MUSIC_URL)
    if (!buffer) return
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
}

/** Stops the gameplay-music loop — call when a round ends (win or loss) or
 * the player leaves back to a menu screen. Safe to call even if nothing is
 * playing. */
export function stopGameplayMusic(): void {
  safely(() => {
    musicSource?.stop()
    musicSource?.disconnect()
  })
  musicSource = null
  musicGain = null
}
