import { useEffect, useRef, useState } from 'react'
import type { ItemRecord } from '@app/api/practice_schema.pure.lib.ts'
import type { components } from '@app/api/openapi_schema.pure.lib.ts'
import { DEFAULT_WEAPON_VIEW, type WeaponViewConfig } from '@app/blaster/blaster_config.pure.lib.ts'
import type { WeaponDefinition } from '@app/blaster/weapon_definitions.pure.lib.ts'
import { errorMessage } from '@app/query/query_state.pure.lib.ts'
import type { CharacterDefinition } from '@app/zombies/character_definitions.pure.lib.ts'
import { applyHit, canShoot, createWave, registerMiss, tick, type HitZone, type WaveConfig, type WaveState } from '@app/zombies/zombie_wave_engine.pure.lib.ts'
import {
  ANSWER_FEEDBACK_MS,
  CONTACT_HOLD_MS,
  IMPACT_TO_FROZEN_MS,
  INTRO_MS,
  SOLVED_DELAY_MS,
  ZOMBIE_ATTACK_SOUND_DELAY_MS,
  ZOMBIE_HIT_SOUND_DELAY_MS,
  aimFromPointer,
  buildWaveConfig,
  isRoundInProgress,
  type ArenaPhase,
  type FeedbackEvent,
  type FeedbackKind,
  type SessionQuestionResult,
} from './arena_session.pure.lib.ts'
import type { ArenaAudio, ArenaQuestion, ArenaRoster, ArenaScheduler, Cancel, ZombieArenaBrain } from './zombie_arena_state.pure.lib.ts'

export interface ArenaSessionDeps {
  readonly brain: ZombieArenaBrain
  readonly weapon: WeaponDefinition
  readonly nextItem: (query: { readonly profileId: number; readonly gameId: string; readonly sessionId: string }) => Promise<ItemRecord>
  readonly submitRating: (rating: components['schemas']['RatingCreate']) => Promise<void>
  readonly scheduler: ArenaScheduler
  readonly audio: ArenaAudio
  readonly roster: ArenaRoster
  readonly createSessionId: () => string
}

/** What the timers, the frame loop, and async results read: always current, unlike a render's closure. */
interface LiveState {
  mounted: boolean
  phase: ArenaPhase
  wave: WaveState | null
  item: ItemRecord | null
  question: ArenaQuestion | null
  config: WaveConfig
  lastFrameMs: number | null
  outcomeHandled: boolean
  sessionId: string
  roster: readonly CharacterDefinition[]
  lives: number
  solved: readonly string[]
  feedbackId: number
  cancelFeedback: Cancel | null
}

/** Everything the arena view renders, and the commands it calls. */
export interface ArenaSession {
  readonly phase: ArenaPhase
  readonly question: ArenaQuestion | null
  readonly wave: WaveState | null
  readonly lives: number
  readonly solvedItems: readonly string[]
  readonly questionResults: readonly SessionQuestionResult[]
  readonly error: string | null
  readonly ratingHandled: boolean
  readonly aimNdc: { readonly x: number; readonly y: number } | null
  readonly recoilSignal: number
  readonly liveMessage: string
  readonly waveCharacters: readonly CharacterDefinition[]
  readonly feedback: FeedbackEvent | null
  readonly audioMuted: boolean
  readonly weaponView: WeaponViewConfig
  readonly hideRightArm: boolean
  readonly hideLeftArm: boolean
  readonly start: () => void
  readonly playAgain: () => void
  readonly nextQuestion: () => void
  readonly hit: (carrierId: string, zone: HitZone) => void
  readonly miss: () => void
  /** Aims at a pointer position inside the arena (a React pointer event fits). Touch doesn't aim: there's no hover. */
  readonly aim: (event: { readonly pointerType: string; readonly clientX: number; readonly clientY: number; readonly currentTarget: Element }) => void
  readonly toggleMute: () => void
  readonly rate: (value: number) => void
  readonly dismissRating: () => void
  readonly sceneFailed: (error: unknown) => void
  readonly setWeaponView: (view: WeaponViewConfig) => void
  readonly setHideRightArm: (hidden: boolean) => void
  readonly setHideLeftArm: (hidden: boolean) => void
}

/**
 * The arena's round and session lifecycle: Start → intro (the question fills
 * the screen) → playing (the wave approaches, the player shoots) → solved, or
 * contact/impact → life lost → next question, until the session is complete
 * or the lives run out. The only caller of the wave engine; the scene only
 * renders and reports hits.
 *
 * Every transition happens where its cause happens (a shot, an engine tick, a
 * timer), not in an effect watching state, so each fires exactly once. All
 * timers and the frame loop are cancelled on unmount, and a question that
 * arrives after the session moved on (Back, Try again) is dropped.
 */
export function useArenaSession({ brain, weapon, nextItem, submitRating, scheduler, audio, roster, createSessionId }: ArenaSessionDeps, profileId: number): ArenaSession {
  const [phase, setPhaseState] = useState<ArenaPhase>('start')
  const [question, setQuestion] = useState<ArenaQuestion | null>(null)
  const [wave, setWaveState] = useState<WaveState | null>(null)
  const [lives, setLivesState] = useState(brain.startingLives)
  const [solvedItems, setSolvedItems] = useState<readonly string[]>([])
  const [questionResults, setQuestionResults] = useState<readonly SessionQuestionResult[]>([])
  const [error, setError] = useState<string | null>(null)
  const [ratingHandled, setRatingHandled] = useState(false)
  const [aimNdc, setAimNdc] = useState<{ readonly x: number; readonly y: number } | null>(null)
  const [recoilSignal, setRecoilSignal] = useState(0)
  const [liveMessage, setLiveMessage] = useState('')
  const [waveCharacters, setWaveCharacters] = useState<readonly CharacterDefinition[]>([])
  const [feedback, setFeedback] = useState<FeedbackEvent | null>(null)
  const [audioMuted, setAudioMuted] = useState(() => audio.isMuted())
  const [weaponView, setWeaponView] = useState<WeaponViewConfig>(DEFAULT_WEAPON_VIEW)
  const [hideRightArm, setHideRightArm] = useState(false)
  const [hideLeftArm, setHideLeftArm] = useState(false)

  const live = useRef<LiveState>({
    mounted: true,
    phase: 'start',
    wave: null,
    item: null,
    question: null,
    config: buildWaveConfig(6000, weapon.cockingMs),
    lastFrameMs: null,
    outcomeHandled: false,
    sessionId: '',
    roster: [],
    lives: brain.startingLives,
    solved: [],
    feedbackId: 0,
    cancelFeedback: null,
  })
  const timers = useRef(new Set<Cancel>())

  function later(ms: number, run: () => void): void {
    const cancel = scheduler.after(ms, () => {
      timers.current.delete(cancel)
      if (live.current.mounted) run()
    })
    timers.current.add(cancel)
  }

  function setPhase(next: ArenaPhase): void {
    live.current.phase = next
    setPhaseState(next)
  }

  function setLives(next: number): void {
    live.current.lives = next
    setLivesState(next)
  }

  function triggerFeedback(kind: FeedbackKind): void {
    live.current.feedbackId += 1
    setFeedback({ kind, id: live.current.feedbackId })
    // Clearing it is what lets the next event replay its animation, even the same kind twice in a row.
    live.current.cancelFeedback?.()
    const cancel = scheduler.after(ANSWER_FEEDBACK_MS, () => {
      timers.current.delete(cancel)
      if (live.current.mounted) setFeedback(null)
    })
    timers.current.add(cancel)
    live.current.cancelFeedback = cancel
  }

  async function fetchQuestion(sessionId: string): Promise<void> {
    setError(null)
    try {
      const item = await nextItem({ profileId, gameId: brain.gameId, sessionId })
      const prepared = brain.prepare(item)
      if (!live.current.mounted || live.current.sessionId !== sessionId) return
      live.current.item = item
      live.current.question = prepared
      live.current.config = buildWaveConfig(prepared.approachMs, weapon.cockingMs)
      live.current.wave = null
      live.current.outcomeHandled = false
      setQuestion(prepared)
      setWaveState(null)
      setPhase('intro')
      // The intro beat: show the whole question, then spawn the wave.
      later(INTRO_MS, () => {
        const next = createWave(prepared.options)
        live.current.lastFrameMs = null
        live.current.wave = next
        setWaveState(next)
        // One of each roster member every wave; the shuffle decides only which lane each takes.
        setWaveCharacters(roster.shuffleLanes(live.current.roster))
        setPhase('playing')
        for (const character of live.current.roster) audio.playGroan(character.groanSoundUrl)
      })
    } catch (err) {
      if (live.current.mounted && live.current.sessionId === sessionId) setError(errorMessage(err))
    }
  }

  function enterImpact(): void {
    setPhase('impact')
    later(IMPACT_TO_FROZEN_MS, () => {
      brain.onLifeLost?.()
      const remaining = Math.max(live.current.lives - 1, 0)
      setLives(remaining)
      if (remaining === 0) {
        setPhase('game_over')
        brain.onSessionEnd?.({ outcome: 'game_over', solvedCount: live.current.solved.length, sessionLength: brain.sessionLength, livesRemaining: 0 })
      } else {
        setPhase('life_lost_frozen')
      }
    })
  }

  /** Handles a wave ending, whichever way the engine resolved it: correct, player contact, or a second wrong defeat. Once per wave. */
  function resolveWave(resolved: WaveState): void {
    const { item, question: current } = live.current
    if (live.current.outcomeHandled || item === null || current === null) return
    live.current.outcomeHandled = true
    const correct = resolved.outcome === 'solved'
    setQuestionResults((previous) => [...previous, { question: current.summary, correct, timeTakenMs: resolved.elapsedMs }])
    brain.onQuestionResult(item, { correct, timeTakenMs: resolved.elapsedMs, wrongShots: resolved.wrongShots }, { profileId, sessionId: live.current.sessionId })

    if (correct) {
      setLiveMessage(`Correct! ${current.summary}`)
      later(SOLVED_DELAY_MS, () => {
        const solved = [...live.current.solved, current.summary]
        live.current.solved = solved
        setSolvedItems(solved)
        if (solved.length >= brain.sessionLength) {
          setPhase('complete')
          brain.onSessionEnd?.({ outcome: 'complete', solvedCount: solved.length, sessionLength: brain.sessionLength, livesRemaining: live.current.lives })
        } else {
          setPhase('transitioning_to_next_wave')
          void fetchQuestion(live.current.sessionId)
        }
      })
      return
    }

    if (resolved.resolutionReason === 'player_contact') {
      setPhase('contact')
      setLiveMessage('A zombie got through!')
      triggerFeedback('playerAttacked')
      // Lands with the swipe itself, not the moment contact resolves.
      later(ZOMBIE_ATTACK_SOUND_DELAY_MS, audio.playZombieAttack)
      later(CONTACT_HOLD_MS, enterImpact)
      return
    }
    setLiveMessage('Too many wrong targets!')
    enterImpact()
  }

  function commitWave(next: WaveState): void {
    live.current.wave = next
    setWaveState(next)
    if (next.outcome !== 'pending') resolveWave(next)
  }

  // The frame loop is set up once; it reaches the latest resolveWave through this.
  const resolveWaveRef = useRef(resolveWave)
  useEffect(() => {
    resolveWaveRef.current = resolveWave
  })

  // One frame loop for the arena's lifetime; it advances the wave only while playing.
  useEffect(() => {
    const state = live.current
    const pending = timers.current
    state.mounted = true
    const stopFrames = scheduler.everyFrame((nowMs) => {
      const current = state.wave
      if (state.phase !== 'playing' || current === null || current.outcome !== 'pending') {
        state.lastFrameMs = null
        return
      }
      const last = state.lastFrameMs
      state.lastFrameMs = nowMs
      if (last === null) return
      const next = tick(current, nowMs - last, state.config)
      state.wave = next
      setWaveState(next)
      if (next.outcome !== 'pending') resolveWaveRef.current(next)
    })
    return () => {
      state.mounted = false
      stopFrames()
      for (const cancel of pending) cancel()
      pending.clear()
      audio.stopMusic()
    }
  }, [scheduler, audio])

  // The music plays for the whole round, across waves and the gap between them, and stops when it ends either way. startMusic is idempotent.
  useEffect(() => {
    if (isRoundInProgress(phase)) audio.startMusic()
    else audio.stopMusic()
  }, [audio, phase])

  function shoot(next: WaveState, before: WaveState): void {
    if (next === before) return
    setRecoilSignal((n) => n + 1)
    audio.playShot()
    const lastHit = next.lastHit
    if (lastHit !== null) {
      // A physical "that hit" cue for a landed body shot, right or wrong; never for a headshot. A beat after the shot sound so the two don't merge.
      if (lastHit.zone === 'body') later(ZOMBIE_HIT_SOUND_DELAY_MS, audio.playZombieHit)
      if (lastHit.correct) triggerFeedback('correctHit')
      // A wrong defeat that also ends the wave gets the stronger life-lost overlay instead; only one that leaves it pending gets its own pulse.
      else if (next.outcome === 'pending') triggerFeedback('wrongHit')
    }
    commitWave(next)
  }

  function start(sessionId: string): void {
    // A real user gesture: create/resume the audio context and start decoding here, well before the first shot is possible.
    audio.preloadWeapon()
    audio.preloadMusic()
    live.current.sessionId = sessionId
    live.current.solved = []
    setLives(brain.startingLives)
    setSolvedItems([])
    setQuestionResults([])
    setRatingHandled(false)
    setQuestion(null)
    live.current.question = null
    live.current.item = null
    // Every new session (Start, Try again) gets a fresh roster; the next question never does.
    live.current.roster = roster.pickForSession()
    audio.preloadZombies(live.current.roster.map((character) => character.groanSoundUrl))
    setPhase('playing')
    void fetchQuestion(sessionId)
  }

  return {
    phase,
    question,
    wave,
    lives,
    solvedItems,
    questionResults,
    error,
    ratingHandled,
    aimNdc,
    recoilSignal,
    liveMessage,
    waveCharacters,
    feedback,
    audioMuted,
    weaponView,
    hideRightArm,
    hideLeftArm,
    start: () => {
      start(createSessionId())
    },
    playAgain: () => {
      start(createSessionId())
    },
    nextQuestion: () => {
      setPhase('transitioning_to_next_wave')
      void fetchQuestion(live.current.sessionId)
    },
    hit: (carrierId, zone) => {
      const before = live.current.wave
      if (before === null || !canShoot(before, live.current.config)) return
      shoot(applyHit(before, carrierId, zone, live.current.config), before)
    },
    miss: () => {
      const before = live.current.wave
      if (before === null || !canShoot(before, live.current.config)) return
      shoot(registerMiss(before, live.current.config), before)
    },
    aim: (event) => {
      if (event.pointerType === 'touch') return
      setAimNdc(aimFromPointer(event.clientX, event.clientY, event.currentTarget.getBoundingClientRect()))
    },
    toggleMute: () => {
      setAudioMuted(audio.toggleMuted())
    },
    rate: (value) => {
      setRatingHandled(true)
      submitRating({ profile_id: profileId, game_id: brain.gameId, scale: 'stars_1_5', value }).catch((err: unknown) => {
        if (live.current.mounted) setError(errorMessage(err))
      })
    },
    dismissRating: () => {
      setRatingHandled(true)
    },
    sceneFailed: (err) => {
      setError(`The 3D scene couldn't load: ${errorMessage(err)}`)
    },
    setWeaponView,
    setHideRightArm,
    setHideLeftArm,
  }
}
