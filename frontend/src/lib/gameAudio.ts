/**
 * Centralized procedural Web Audio system for Equation Outbreak. Every
 * sound is synthesized at runtime (oscillators, a shared noise buffer, and
 * gain/filter envelopes) — nothing is loaded from a file, so there is
 * nothing here that can fail to *load*; only the AudioContext itself can
 * be unavailable (older browsers, restrictive environments, jsdom in
 * tests), which every exported function treats as a silent no-op.
 *
 * A single `AudioContext` is created lazily on first use and reused for
 * the lifetime of the page — browsers require a user gesture before audio
 * can actually start, which every caller here already has (a shot or a
 * cock is always the direct result of the player's own click).
 *
 * This module currently implements only the two Equation Blaster sounds
 * (fire, the two halves of cocking) plus mute state. The registry shape
 * (one small exported `play*Sound` function per cue, all going through the
 * same lazy context/mute plumbing) is deliberately how a later task would
 * add zombie groans, defeat stingers, correct/wrong cues, music, or
 * victory/game-over audio — without changing anything exported here.
 */

const MUTE_STORAGE_KEY = 'equationOutbreak:audioMuted'

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
let noiseBufferCache: AudioBuffer | null = null

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

/** A short cached noise buffer, reused across every shot rather than
 * regenerated each time. */
function getNoiseBuffer(ctx: AudioContext): AudioBuffer {
  if (noiseBufferCache && noiseBufferCache.sampleRate === ctx.sampleRate) return noiseBufferCache
  const duration = 0.3
  const buffer = ctx.createBuffer(1, Math.max(1, Math.ceil(ctx.sampleRate * duration)), ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  noiseBufferCache = buffer
  return buffer
}

/** Runs `fn`, swallowing any error — a synthesis mistake or an
 * unsupported node type must never take gameplay down with it. */
function safely(fn: () => void): void {
  try {
    fn()
  } catch {
    // Audio must never break gameplay.
  }
}

/**
 * A brief, child-friendly "science blaster" zap: a short filtered-noise
 * impact, a low electronic pulse, and a quick descending tone, all through
 * one master gain kept conservative — plus a touch of shot-to-shot pitch
 * variation so two shots in a row don't sound identical. Deliberately
 * nothing like a realistic firearm recording, and every gain envelope
 * ramps rather than jumps, so there's no sharp transient.
 */
export function playShotSound(): void {
  if (muted) return
  safely(() => {
    const ctx = getAudioContext()
    if (!ctx) return
    const now = ctx.currentTime
    const pitch = 0.94 + Math.random() * 0.12 // ±~6%

    const master = ctx.createGain()
    master.gain.value = 0.22
    master.connect(ctx.destination)

    // Brief filtered-noise impact.
    const noise = ctx.createBufferSource()
    noise.buffer = getNoiseBuffer(ctx)
    const noiseFilter = ctx.createBiquadFilter()
    noiseFilter.type = 'bandpass'
    noiseFilter.frequency.value = 1800 * pitch
    noiseFilter.Q.value = 0.8
    const noiseGain = ctx.createGain()
    noiseGain.gain.setValueAtTime(0.001, now)
    noiseGain.gain.linearRampToValueAtTime(0.5, now + 0.005)
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06)
    noise.connect(noiseFilter).connect(noiseGain).connect(master)
    noise.start(now)
    noise.stop(now + 0.08)

    // Short low electronic pulse.
    const pulse = ctx.createOscillator()
    pulse.type = 'square'
    pulse.frequency.setValueAtTime(180 * pitch, now)
    const pulseGain = ctx.createGain()
    pulseGain.gain.setValueAtTime(0.001, now)
    pulseGain.gain.linearRampToValueAtTime(0.32, now + 0.005)
    pulseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09)
    pulse.connect(pulseGain).connect(master)
    pulse.start(now)
    pulse.stop(now + 0.1)

    // Quick descending energy tone.
    const sweep = ctx.createOscillator()
    sweep.type = 'sawtooth'
    sweep.frequency.setValueAtTime(1400 * pitch, now + 0.01)
    sweep.frequency.exponentialRampToValueAtTime(320 * pitch, now + 0.16)
    const sweepGain = ctx.createGain()
    sweepGain.gain.setValueAtTime(0.001, now)
    sweepGain.gain.linearRampToValueAtTime(0.26, now + 0.015)
    sweepGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18)
    sweep.connect(sweepGain).connect(master)
    sweep.start(now + 0.01)
    sweep.stop(now + 0.19)
  })
}

/** The first half of cocking — the left hand racking the pump back: a
 * short filtered-noise slide/friction rasp plus a low mechanical thunk,
 * louder and longer than the original soft click so it actually reads as
 * "reloading" now that the motion driving it is visible. */
export function playCockingBackSound(): void {
  if (muted) return
  safely(() => {
    const ctx = getAudioContext()
    if (!ctx) return
    const now = ctx.currentTime
    const master = ctx.createGain()
    master.gain.value = 0.3
    master.connect(ctx.destination)

    // Mechanical slide/friction rasp — filtered noise sweeping downward.
    const slide = ctx.createBufferSource()
    slide.buffer = getNoiseBuffer(ctx)
    const slideFilter = ctx.createBiquadFilter()
    slideFilter.type = 'bandpass'
    slideFilter.Q.value = 1.1
    slideFilter.frequency.setValueAtTime(1400, now)
    slideFilter.frequency.exponentialRampToValueAtTime(500, now + 0.14)
    const slideGain = ctx.createGain()
    slideGain.gain.setValueAtTime(0.001, now)
    slideGain.gain.linearRampToValueAtTime(0.4, now + 0.02)
    slideGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15)
    slide.connect(slideFilter).connect(slideGain).connect(master)
    slide.start(now)
    slide.stop(now + 0.16)

    // Low mechanical thunk as the pump reaches the back of its travel.
    const thunk = ctx.createOscillator()
    thunk.type = 'triangle'
    thunk.frequency.setValueAtTime(180, now + 0.1)
    thunk.frequency.exponentialRampToValueAtTime(70, now + 0.2)
    const thunkGain = ctx.createGain()
    thunkGain.gain.setValueAtTime(0.001, now + 0.1)
    thunkGain.gain.linearRampToValueAtTime(0.5, now + 0.11)
    thunkGain.gain.exponentialRampToValueAtTime(0.001, now + 0.24)
    thunk.connect(thunkGain).connect(master)
    thunk.start(now + 0.1)
    thunk.stop(now + 0.25)
  })
}

/** The second half of cocking — the pump slamming forward and locking, plus
 * a short power-up chirp as the weapon becomes ready. Louder/punchier than
 * the original soft click for the same reason as playCockingBackSound. */
export function playCockingForwardSound(): void {
  if (muted) return
  safely(() => {
    const ctx = getAudioContext()
    if (!ctx) return
    const now = ctx.currentTime
    const master = ctx.createGain()
    master.gain.value = 0.3
    master.connect(ctx.destination)

    // Sharp mechanical clunk as the pump locks forward.
    const clunk = ctx.createOscillator()
    clunk.type = 'square'
    clunk.frequency.setValueAtTime(220, now)
    clunk.frequency.exponentialRampToValueAtTime(90, now + 0.06)
    const clunkGain = ctx.createGain()
    clunkGain.gain.setValueAtTime(0.001, now)
    clunkGain.gain.linearRampToValueAtTime(0.55, now + 0.006)
    clunkGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09)
    clunk.connect(clunkGain).connect(master)
    clunk.start(now)
    clunk.stop(now + 0.1)

    // A brief noise transient layered under the clunk for extra mechanical bite.
    const snap = ctx.createBufferSource()
    snap.buffer = getNoiseBuffer(ctx)
    const snapFilter = ctx.createBiquadFilter()
    snapFilter.type = 'bandpass'
    snapFilter.frequency.value = 900
    snapFilter.Q.value = 0.7
    const snapGain = ctx.createGain()
    snapGain.gain.setValueAtTime(0.001, now)
    snapGain.gain.linearRampToValueAtTime(0.3, now + 0.004)
    snapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05)
    snap.connect(snapFilter).connect(snapGain).connect(master)
    snap.start(now)
    snap.stop(now + 0.06)

    // Short power-up chirp signaling the weapon is ready to fire again.
    const chirp = ctx.createOscillator()
    chirp.type = 'sine'
    chirp.frequency.setValueAtTime(500, now + 0.08)
    chirp.frequency.exponentialRampToValueAtTime(1100, now + 0.2)
    const chirpGain = ctx.createGain()
    chirpGain.gain.setValueAtTime(0.001, now + 0.08)
    chirpGain.gain.linearRampToValueAtTime(0.24, now + 0.1)
    chirpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.24)
    chirp.connect(chirpGain).connect(master)
    chirp.start(now + 0.08)
    chirp.stop(now + 0.25)
  })
}
