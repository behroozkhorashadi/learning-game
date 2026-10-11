import { useEffect, useRef, useState } from 'react'
import type { AttemptBody, ItemRecord } from '@app/api/practice_schema.pure.lib.ts'
import type { ArenaAudio, ArenaScheduler, Cancel } from '@app/outbreak/zombie_arena_state.pure.lib.ts'
import { errorMessage } from '@app/query/query_state.pure.lib.ts'
import type { CharacterDefinition } from '@app/zombies/character_definitions.pure.lib.ts'
import { GRENADE, shotPower, type Loadout } from './horde_armory.pure.lib.ts'
import {
  ROUND_MS,
  STARTING_LIVES,
  createRound,
  setQuestion,
  shoot as shootEngine,
  throwGrenade as throwEngine,
  tick,
  type HordeConfig,
  type HordeEvent,
  type HordeQuestion,
  type HordeState,
  type ShotTarget,
} from './horde_engine.pure.lib.ts'
import { COVER } from './horde_field.pure.lib.ts'
import { HORDE_GAME_ID, hordeQuestion, travelMsFor } from './horde_question.pure.lib.ts'
import { roundPoints } from './horde_scoring.pure.lib.ts'

/** The question fills the screen for a beat before the horde moves. */
export const INTRO_MS = 1500
/** A beat after a right answer before the next question replaces it. */
export const NEXT_QUESTION_MS = 600
/** How long a hit/wrong/hurt flash shows. */
export const FEEDBACK_MS = 420
/** The longest frame step the engine takes, so a backgrounded tab doesn't teleport the horde. */
const MAX_STEP_MS = 50

export type HordePhase = 'ready' | 'loading' | 'intro' | 'playing' | 'over'

export type FeedbackKind = 'correct' | 'wrong' | 'hurt' | 'boom' | 'dud'

export interface Feedback {
  readonly kind: FeedbackKind
  readonly id: number
}

/** Banking the round's points into the armory. */
export type BankState = { readonly kind: 'idle' } | { readonly kind: 'saving' } | { readonly kind: 'saved'; readonly balance: number } | { readonly kind: 'failed'; readonly message: string }

export interface SolvedFact {
  readonly summary: string
  readonly timeMs: number
}

export interface HordeRoundDeps {
  readonly nextItem: (query: { readonly profileId: number; readonly gameId: string; readonly sessionId: string }) => Promise<ItemRecord>
  /** POST /api/attempts. A failure is reported, never interrupts play. */
  readonly recordAttempt: (attempt: AttemptBody) => Promise<unknown>
  /** Banks a finished round into the armory; resolves to the new balance. */
  readonly bankRound: (profileId: number, round: { readonly points: number; readonly grenades_used: number }) => Promise<{ readonly balance: number }>
  readonly scheduler: ArenaScheduler
  readonly audio: ArenaAudio
  /** This round's four characters, one per slot. */
  readonly pickRoster: () => readonly CharacterDefinition[]
  readonly createSessionId: () => string
  /** The seed for the round's movement. */
  readonly newSeed: () => number
  readonly reportError: (message: string, error: unknown) => void
}

export interface HordeRound {
  readonly phase: HordePhase
  readonly state: HordeState | null
  readonly characters: readonly CharacterDefinition[]
  readonly loadout: Loadout | null
  readonly error: string | null
  readonly liveMessage: string
  readonly feedback: Feedback | null
  readonly recoilSignal: number
  readonly grenadeArmed: boolean
  readonly audioMuted: boolean
  readonly solved: readonly SolvedFact[]
  readonly points: number
  readonly bank: BankState
  readonly durationMs: number
  readonly start: (loadout: Loadout, grenades: number) => void
  /** Back to the start screen (the shop and loadout). */
  readonly reset: () => void
  readonly shoot: (target: ShotTarget | null) => void
  readonly toggleGrenade: () => void
  readonly throwGrenade: (at: { readonly x: number; readonly depth: number }) => void
  readonly toggleMute: () => void
  readonly sceneFailed: (error: unknown) => void
}

interface Live {
  mounted: boolean
  phase: HordePhase
  state: HordeState | null
  config: HordeConfig | null
  sessionId: string
  lastFrameMs: number | null
  items: Map<string, ItemRecord>
  /** The next question, fetched ahead so a right answer never waits on the network. */
  upcoming: Promise<{ readonly item: ItemRecord; readonly question: HordeQuestion }> | null
  feedbackId: number
  cancelFeedback: Cancel | null
  characters: readonly CharacterDefinition[]
}

/**
 * Zombie Horde's round lifecycle: start (with the chosen loadout) → the first
 * question loads → intro → 60 seconds of play → over, with the round's points
 * banked into the armory. The only caller of the engine; the scene renders
 * and reports shots, the HUD reports button presses.
 *
 * Questions come from the server one at a time, the next one always fetched
 * ahead. Each solved question is recorded as an attempt (`hints_used` is the
 * wrong shots it took), so the server's adaptive loop sees this game like any
 * other. Every transition happens where its cause happens (a shot, a tick, a
 * timer, a fetch), never in an effect watching state; timers and the frame
 * loop are cancelled on unmount, and results for a superseded round are dropped.
 */
export function useHordeRound(deps: HordeRoundDeps, profileId: number): HordeRound {
  const { nextItem, recordAttempt, bankRound, scheduler, audio, pickRoster, createSessionId, newSeed, reportError } = deps
  const [phase, setPhaseState] = useState<HordePhase>('ready')
  const [state, setStateValue] = useState<HordeState | null>(null)
  const [characters, setCharacters] = useState<readonly CharacterDefinition[]>([])
  const [loadout, setLoadout] = useState<Loadout | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [liveMessage, setLiveMessage] = useState('')
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [recoilSignal, setRecoilSignal] = useState(0)
  const [grenadeArmed, setGrenadeArmed] = useState(false)
  const [audioMuted, setAudioMuted] = useState(() => audio.isMuted())
  const [solved, setSolved] = useState<readonly SolvedFact[]>([])
  const [bank, setBank] = useState<BankState>({ kind: 'idle' })

  const live = useRef<Live>({
    mounted: true,
    phase: 'ready',
    state: null,
    config: null,
    sessionId: '',
    lastFrameMs: null,
    items: new Map(),
    upcoming: null,
    feedbackId: 0,
    cancelFeedback: null,
    characters: [],
  })
  const timers = useRef(new Set<Cancel>())

  function later(ms: number, run: () => void): void {
    const cancel = scheduler.after(ms, () => {
      timers.current.delete(cancel)
      if (live.current.mounted) run()
    })
    timers.current.add(cancel)
  }

  function setPhase(next: HordePhase): void {
    live.current.phase = next
    setPhaseState(next)
  }

  function flash(kind: FeedbackKind): void {
    live.current.feedbackId += 1
    setFeedback({ kind, id: live.current.feedbackId })
    live.current.cancelFeedback?.()
    const cancel = scheduler.after(FEEDBACK_MS, () => {
      timers.current.delete(cancel)
      if (live.current.mounted) setFeedback(null)
    })
    timers.current.add(cancel)
    live.current.cancelFeedback = cancel
  }

  function fetchQuestion(sessionId: string): Promise<{ readonly item: ItemRecord; readonly question: HordeQuestion }> {
    return nextItem({ profileId, gameId: HORDE_GAME_ID, sessionId }).then((item) => {
      live.current.items.set(item.item_id, item)
      return { item, question: hordeQuestion(item) }
    })
  }

  /** Shows the prefetched question (once it's in) and starts fetching the one after. */
  function showNextQuestion(sessionId: string): void {
    const upcoming = live.current.upcoming ?? fetchQuestion(sessionId)
    live.current.upcoming = fetchQuestion(sessionId)
    // A failed prefetch only matters once it's needed; until then, don't let it surface as unhandled.
    live.current.upcoming.catch(() => undefined)
    upcoming.then(
      ({ question }) => {
        const current = live.current.state
        if (!live.current.mounted || live.current.sessionId !== sessionId || current === null) return
        commit(setQuestion(current, question))
      },
      (err: unknown) => {
        if (live.current.mounted && live.current.sessionId === sessionId) setError(errorMessage(err))
      },
    )
  }

  function record(questionId: string, correct: boolean, timeMs: number, wrongShots: number): void {
    const item = live.current.items.get(questionId)
    if (item === undefined) return
    recordAttempt({
      item_id: item.item_id,
      profile_id: profileId,
      game_id: item.game_id,
      session_id: live.current.sessionId,
      telemetry: { correct, hints_used: wrongShots, time_ms: Math.round(timeMs) },
      details: { wrong_shots: wrongShots },
    }).catch((err: unknown) => {
      reportError('POST /api/attempts failed', err)
    })
  }

  function finish(final: HordeState): void {
    setPhase('over')
    setGrenadeArmed(false)
    // A question they tried and didn't get counts as a miss; one nobody shot at says nothing.
    if (final.question !== null && final.questionWrongShots > 0) record(final.question.id, false, final.elapsedMs - final.questionStartedMs, final.questionWrongShots)
    const points = roundPoints(final.stats, final.outcome, final.lives)
    setLiveMessage(final.outcome === 'survived' ? `You held off the horde! ${String(points)} points.` : `The horde got through. ${String(points)} points.`)
    const sessionId = live.current.sessionId
    setBank({ kind: 'saving' })
    bankRound(profileId, { points, grenades_used: final.stats.grenadesUsed }).then(
      ({ balance }) => {
        if (live.current.mounted && live.current.sessionId === sessionId) setBank({ kind: 'saved', balance })
      },
      (err: unknown) => {
        if (live.current.mounted && live.current.sessionId === sessionId) setBank({ kind: 'failed', message: errorMessage(err) })
      },
    )
  }

  function react(events: readonly HordeEvent[], next: HordeState): void {
    for (const event of events) {
      switch (event.type) {
        case 'shot':
          setRecoilSignal((n) => n + 1)
          audio.playShot()
          break
        case 'hit':
          if (event.zone !== 'head') audio.playZombieHit()
          flash('correct')
          break
        case 'solved':
          record(event.questionId, true, event.timeMs, event.wrongShots)
          setSolved((previous) => [...previous, { summary: event.summary, timeMs: event.timeMs }])
          setLiveMessage(`Correct! ${event.summary}`)
          later(NEXT_QUESTION_MS, () => {
            if (live.current.phase === 'playing') showNextQuestion(live.current.sessionId)
          })
          break
        case 'dodged':
          flash('wrong')
          setLiveMessage('Wrong zombie! It dodged.')
          break
        case 'thrown':
          break
        case 'playerHit':
          audio.playZombieAttack()
          flash('hurt')
          setLiveMessage(event.cause === 'thrown' ? 'Ouch! You got hit.' : 'A zombie got through!')
          break
        case 'grenade':
          flash(event.dud ? 'dud' : 'boom')
          setGrenadeArmed(false)
          if (event.dud) setLiveMessage('The grenade fizzled: it only works near the right answer.')
          break
        case 'spawned': {
          const character = live.current.characters[event.slot]
          if (character !== undefined) audio.playGroan(character.groanSoundUrl)
          break
        }
        case 'roundOver':
          finish(next)
          break
        default:
          assertNever(event)
      }
    }
  }

  function commit(next: HordeState): void {
    live.current.state = next
    setStateValue(next)
    if (next.events.length > 0) react(next.events, next)
  }

  const commitRef = useRef(commit)
  useEffect(() => {
    commitRef.current = commit
  })

  // One frame loop for the game's lifetime; it advances the round only while playing.
  useEffect(() => {
    const current = live.current
    const pending = timers.current
    current.mounted = true
    const stopFrames = scheduler.everyFrame((nowMs) => {
      const round = current.state
      const config = current.config
      if (current.phase !== 'playing' || round === null || config === null) {
        current.lastFrameMs = null
        return
      }
      const last = current.lastFrameMs
      current.lastFrameMs = nowMs
      if (last === null) return
      commitRef.current(tick(round, Math.min(nowMs - last, MAX_STEP_MS), config))
    })
    return () => {
      current.mounted = false
      stopFrames()
      for (const cancel of pending) cancel()
      pending.clear()
      audio.stopMusic()
    }
  }, [scheduler, audio])

  // Music plays while a round is on, and stops when it's over either way. startMusic is idempotent.
  useEffect(() => {
    if (phase === 'intro' || phase === 'playing') audio.startMusic()
    else audio.stopMusic()
  }, [audio, phase])

  function start(chosen: Loadout, grenades: number): void {
    // A real user gesture: create/resume the audio context here, well before the first shot.
    audio.preloadWeapon()
    audio.preloadMusic()
    const sessionId = createSessionId()
    const roster = pickRoster()
    audio.preloadZombies(roster.map((character) => character.groanSoundUrl))
    for (const cancel of timers.current) cancel()
    timers.current.clear()
    Object.assign(live.current, { sessionId, state: null, config: null, items: new Map(), upcoming: null, lastFrameMs: null, characters: roster })
    setCharacters(roster)
    setLoadout(chosen)
    setStateValue(null)
    setSolved([])
    setBank({ kind: 'idle' })
    setError(null)
    setGrenadeArmed(false)
    setPhase('loading')
    fetchQuestion(sessionId).then(
      ({ item, question }) => {
        if (!live.current.mounted || live.current.sessionId !== sessionId) return
        live.current.config = { durationMs: ROUND_MS, travelMs: travelMsFor(item), power: shotPower(chosen), cooldownMs: chosen.weapon.cooldownMs, grenade: GRENADE, cover: COVER }
        live.current.upcoming = fetchQuestion(sessionId)
        live.current.upcoming.catch(() => undefined)
        commit(setQuestion(createRound({ seed: newSeed(), lives: STARTING_LIVES, grenades, cover: COVER }), question))
        setPhase('intro')
        for (const character of roster) audio.playGroan(character.groanSoundUrl)
        later(INTRO_MS, () => {
          live.current.lastFrameMs = null
          setPhase('playing')
        })
      },
      (err: unknown) => {
        if (live.current.mounted && live.current.sessionId === sessionId) setError(errorMessage(err))
      },
    )
  }

  const round = state
  const finalPoints = round === null || round.outcome === 'playing' ? 0 : roundPoints(round.stats, round.outcome, round.lives)

  return {
    phase,
    state,
    characters,
    loadout,
    error,
    liveMessage,
    feedback,
    recoilSignal,
    grenadeArmed,
    audioMuted,
    solved,
    points: finalPoints,
    bank,
    durationMs: ROUND_MS,
    start,
    reset: () => {
      for (const cancel of timers.current) cancel()
      timers.current.clear()
      live.current.sessionId = ''
      live.current.state = null
      setStateValue(null)
      setPhase('ready')
    },
    shoot: (target) => {
      const current = live.current.state
      const config = live.current.config
      if (live.current.phase !== 'playing' || current === null || config === null) return
      const next = shootEngine(current, target, config)
      if (next !== current) commit(next)
    },
    toggleGrenade: () => {
      const current = live.current.state
      if (live.current.phase !== 'playing' || current === null || current.grenades <= 0) return
      setGrenadeArmed((armed) => !armed)
    },
    throwGrenade: (at) => {
      const current = live.current.state
      const config = live.current.config
      if (live.current.phase !== 'playing' || current === null || config === null) return
      const next = throwEngine(current, at, config)
      if (next === current) setGrenadeArmed(false)
      else commit(next)
    },
    toggleMute: () => {
      setAudioMuted(audio.toggleMuted())
    },
    sceneFailed: (err) => {
      setError(`The 3D scene couldn't load: ${errorMessage(err)}`)
    },
  }
}

function assertNever(value: never): never {
  throw new Error(`Unexpected event: ${JSON.stringify(value)}`)
}
