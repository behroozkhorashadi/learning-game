import { useEffect, useRef, useState } from 'react'
import type { AttemptBody, ItemRecord } from '@app/api/practice_schema.pure.lib.ts'
import type { ArenaAudio, ArenaScheduler, Cancel } from '@app/outbreak/zombie_arena_state.pure.lib.ts'
import { errorMessage } from '@app/query/query_state.pure.lib.ts'
import type { CharacterDefinition } from '@app/zombies/character_definitions.pure.lib.ts'
import { GRENADE, NO_ROUND_ARMOR, STARTER_LOADOUT, gemsUsedByItem, shotPower, type Armor, type Loadout, type RoundArmor } from './horde_armory.pure.lib.ts'
import {
  ROUND_MS,
  STARTING_LIVES,
  createRound,
  setQuestion,
  SHOVES_PER_ROUND,
  shoot as shootEngine,
  shove as shoveEngine,
  reveal as revealEngine,
  closestZombie,
  endOvertime as endOvertimeEngine,
  inOvertime,
  throwGrenade as throwEngine,
  tick,
  type HordeConfig,
  type HordeEvent,
  type HordeQuestion,
  type HordeState,
  type ShotTarget,
} from './horde_engine.pure.lib.ts'
import { CAMERA_POSITION, COVER } from './horde_field.pure.lib.ts'
import { HORDE_GAME_ID, hordeQuestion } from './horde_question.pure.lib.ts'
import { RECORDING_VERSION, finished, startRecording, withFlag, withFrame, withGrenade, withQuestion, withShot, type Recording, type ShotDetail } from './horde_recording.pure.lib.ts'
import { formatTime, isNewBest, roundPoints, roundResult, type RoundResult } from './horde_scoring.pure.lib.ts'

/** The question fills the screen for a beat before the horde moves. */
export const INTRO_MS = 1500
/** A beat after a right answer before the next question replaces it. */
export const NEXT_QUESTION_MS = 600
/** How long a hit/wrong/hurt flash shows. */
export const FEEDBACK_MS = 420
/** How long the out-of-special-rounds banner stays up. */
export const OUT_OF_ROUNDS_MS = 2500
/** How long the earned-a-push-back banner stays up. */
export const SHOVE_EARNED_MS = 2000
/** The longest frame step the engine takes, so a backgrounded tab doesn't teleport the horde. */
const MAX_STEP_MS = 50

export type HordePhase = 'ready' | 'loading' | 'intro' | 'playing' | 'over'

export type FeedbackKind = 'correct' | 'wrong' | 'hurt' | 'boom' | 'dud' | 'shove' | 'reflect' | 'block' | 'heal'

/** What the next click does: a normal shot or a grenade. */
export type ArmedMode = 'shot' | 'grenade'

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
  /** Banks a finished round (and how long it lasted, toward the personal best) into the armory; resolves to the new balance. */
  readonly bankRound: (profileId: number, round: { readonly points: number; readonly grenades_used: number; readonly rounds_used: Readonly<Record<string, number>>; readonly gems_used: Readonly<Record<string, number>>; readonly survived_ms: number }) => Promise<{ readonly balance: number }>
  readonly scheduler: ArenaScheduler
  readonly audio: ArenaAudio
  /** This round's four characters, one per slot. */
  readonly pickRoster: () => readonly CharacterDefinition[]
  readonly createSessionId: () => string
  /** The seed for the round's movement. */
  readonly newSeed: () => number
  readonly reportError: (message: string, error: unknown) => void
  /** Keeps a round's recording (the server keeps a profile's last few). A failure is reported, never interrupts play. */
  readonly saveReplay: (profileId: number, recording: Recording) => Promise<unknown>
  /** The current time as ISO-8601, for the recording's start time. */
  readonly nowIso: () => string
  /** How long a zombie takes to cross the field for this item. In the app, horde_question's `travelMsFor`. */
  readonly travelMsFor: (item: ItemRecord) => number
}

export interface HordeRound {
  readonly phase: HordePhase
  readonly state: HordeState | null
  readonly characters: readonly CharacterDefinition[]
  readonly loadout: Loadout | null
  readonly error: string | null
  readonly liveMessage: string
  readonly feedback: Feedback | null
  /** The last special round was just fired; true for a moment so the HUD can say so. */
  readonly outOfRounds: boolean
  readonly recoilSignal: number
  readonly armed: ArmedMode
  readonly audioMuted: boolean
  readonly solved: readonly SolvedFact[]
  /** Facts answered with "I don't know", for the end screen's practice list. */
  readonly missed: readonly SolvedFact[]
  /** Another push-back was just earned; true for a moment so the HUD can say so. */
  readonly shoveEarned: boolean
  /** The finished round, for the end screen; null until it's over. */
  readonly result: RoundResult | null
  readonly points: number
  readonly bank: BankState
  /** The clock to beat before overtime. */
  readonly durationMs: number
  /** The profile's longest round before this one (0 before its first): the record to beat. */
  readonly previousBestMs: number
  /** Starts a round with this loadout, the grenades owned, the loadout's special rounds owned (0 for standard rounds), the profile's personal best, and the armor worn (gem charges and thorns; none when left out). */
  readonly start: (loadout: Loadout, grenades: number, ammo: number, previousBestMs: number, armor?: RoundArmor) => void
  /** Back to the start screen (the shop and loadout). */
  readonly reset: () => void
  /** A shot at a zombie (or at nothing: null). */
  readonly shoot: (target: ShotTarget | null, detail: ShotDetail) => void
  /** Where the player is aiming, for the recording (no re-render). */
  readonly trackAim: (aim: { readonly x: number; readonly y: number } | null) => void
  /** Flags this moment in the recording, to look at later ("flag 2"). */
  readonly flag: () => void
  /** Flags marked so far this round. */
  readonly flags: number
  readonly toggleGrenade: () => void
  /** Pushes the closest zombie all the way back, whatever its answer (space bar). */
  readonly pushBack: () => void
  /** "I don't know": shows the answer, and records the question as a miss. */
  readonly dontKnow: () => void
  /** Stops in overtime and banks the round. */
  readonly endOvertime: () => void
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
  /** The loaded bullet, for reporting the special rounds a round used. */
  bulletId: string
  /** This round's recording; null when there's no round, or once it's been saved. */
  recording: Recording | null
  aim: { readonly x: number; readonly y: number } | null
  previousBestMs: number
}

/**
 * Zombie Horde's round lifecycle: start (with the chosen loadout) → the first
 * question loads → intro → 60 seconds of play → overtime, until the horde
 * gets through or the player stops → over, with the round's points (and how
 * long it lasted, toward the personal best) banked into the armory. The only caller of the engine; the scene renders
 * and reports shots, the HUD reports button presses.
 *
 * Questions come from the server one at a time, the next one always fetched
 * ahead. Each solved question is recorded as an attempt (`hints_used` is the
 * wrong shots it took), and one answered with "I don't know" as a miss the
 * moment the answer shows, so the server's adaptive loop sees this game like
 * any other and eases off when the questions get too hard. Every transition happens where its cause happens (a shot, a tick, a
 * timer, a fetch), never in an effect watching state; timers and the frame
 * loop are cancelled on unmount, and results for a superseded round are dropped.
 */
export function useHordeRound(deps: HordeRoundDeps, profileId: number): HordeRound {
  const { nextItem, recordAttempt, bankRound, scheduler, audio, pickRoster, createSessionId, newSeed, reportError, saveReplay, nowIso, travelMsFor } = deps
  const [phase, setPhaseState] = useState<HordePhase>('ready')
  const [state, setStateValue] = useState<HordeState | null>(null)
  const [characters, setCharacters] = useState<readonly CharacterDefinition[]>([])
  const [loadout, setLoadout] = useState<Loadout | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [liveMessage, setLiveMessage] = useState('')
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [outOfRounds, setOutOfRounds] = useState(false)
  const [recoilSignal, setRecoilSignal] = useState(0)
  const [armed, setArmed] = useState<ArmedMode>('shot')
  const [audioMuted, setAudioMuted] = useState(() => audio.isMuted())
  const [solved, setSolved] = useState<readonly SolvedFact[]>([])
  const [missed, setMissed] = useState<readonly SolvedFact[]>([])
  const [shoveEarned, setShoveEarned] = useState(false)
  const [bank, setBank] = useState<BankState>({ kind: 'idle' })
  const [flags, setFlags] = useState(0)
  const [previousBestMs, setPreviousBestMs] = useState(0)

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
    bulletId: '',
    recording: null,
    aim: null,
    previousBestMs: 0,
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

  function showOutOfRounds(): void {
    setOutOfRounds(true)
    later(OUT_OF_ROUNDS_MS, () => {
      setOutOfRounds(false)
    })
  }

  function showShoveEarned(): void {
    setShoveEarned(true)
    later(SHOVE_EARNED_MS, () => {
      setShoveEarned(false)
    })
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
        const asked = setQuestion(current, question)
        commit(asked)
        record_(live.current.recording === null ? null : withQuestion(live.current.recording, asked, question))
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

  function record_(recording: Recording | null): void {
    if (recording !== null) live.current.recording = recording
  }

  /** Saves the round's recording once, however the round ended. */
  function saveRecording(final: HordeState | null, outcome: HordeState['outcome'] | 'left'): void {
    const recording = live.current.recording
    if (recording === null) return
    live.current.recording = null
    saveReplay(profileId, finished(recording, final, outcome)).catch((err: unknown) => {
      reportError('Saving the round recording failed', err)
    })
  }

  function finish(final: HordeState): void {
    saveRecording(final, final.outcome)
    setPhase('over')
    setArmed('shot')
    // A question they tried and didn't get counts as a miss; one nobody shot at says nothing. A revealed one was recorded when it was revealed.
    if (final.question !== null && !final.questionRevealed && final.questionWrongShots > 0) record(final.question.id, false, final.elapsedMs - final.questionStartedMs, final.questionWrongShots)
    const result = roundResult(final, ROUND_MS, live.current.previousBestMs)
    const points = roundPoints(result)
    const lasted = isNewBest(result) ? ` New personal best: ${formatTime(final.elapsedMs)}!` : ''
    setLiveMessage(`${final.outcome === 'survived' ? 'You held off the horde!' : 'The horde got through.'}${lasted} ${String(points)} points.`)
    const sessionId = live.current.sessionId
    setBank({ kind: 'saving' })
    const bullet = live.current.bulletId
    bankRound(profileId, { points, grenades_used: final.stats.grenadesUsed, rounds_used: final.stats.roundsUsed > 0 ? { [bullet]: final.stats.roundsUsed } : {}, gems_used: gemsUsedByItem(final.stats.gemsUsed), survived_ms: Math.round(final.elapsedMs) }).then(
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
          if (event.revealed) {
            setLiveMessage(`Got it: ${event.summary}`)
          } else {
            record(event.questionId, true, event.timeMs, event.wrongShots)
            setSolved((previous) => [...previous, { summary: event.summary, timeMs: event.timeMs }])
            setLiveMessage(`Correct! ${event.summary}`)
          }
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
        case 'reflected':
          flash('reflect')
          setLiveMessage(armorMessage('Reflected! Your armor bounced it back.', next.armor))
          break
        case 'bounced':
          audio.playZombieHit()
          break
        case 'blocked':
          audio.playZombieAttack()
          flash('block')
          setLiveMessage(armorMessage((live.current.config?.thornsDamage ?? 0) > 0 ? 'Blocked! Your thorns hurt it, it only took half a heart, and it flew back.' : 'Blocked! Only half a heart, and the zombie flew back.', next.armor))
          break
        case 'healed':
          flash('heal')
          setLiveMessage(armorMessage('Healed! Your streak won back half a heart.', next.armor))
          break
        case 'grenade':
          flash(event.dud ? 'dud' : 'boom')
          setArmed('shot')
          if (event.dud) setLiveMessage('The grenade fizzled: it only works near the right answer.')
          break
        case 'spawned': {
          const character = live.current.characters[event.slot]
          if (character !== undefined) audio.playGroan(character.groanSoundUrl)
          break
        }
        case 'shoved':
          flash('shove')
          setLiveMessage('Pushed back!')
          break
        case 'shoveEarned':
          showShoveEarned()
          setLiveMessage((previous) => `${previous} You earned a push-back!`)
          break
        case 'revealed':
          record(event.questionId, false, event.timeMs, event.wrongShots)
          setMissed((previous) => [...previous, { summary: event.summary, timeMs: event.timeMs }])
          setLiveMessage(`The answer is ${event.summary}. Zap that zombie to keep going.`)
          break
        case 'overtime':
          setLiveMessage(`${String(ROUND_MS / 1000)} seconds! Overtime: the zombies speed up. Stop any time to bank your points.`)
          break
        case 'outOfAmmo':
          showOutOfRounds()
          setLiveMessage('Out of special rounds: back to standard rounds.')
          break
        case 'roundOver':
          finish(next)
          break
        default:
          assertNever(event)
      }
    }
  }

  /** Makes `next` the round's state and reacts to its events; `recorded` when the caller has already recorded it. */
  function commit(next: HordeState, recorded = false): void {
    const best = live.current.previousBestMs
    const before = live.current.state?.elapsedMs ?? 0
    if (best > 0 && next.outcome === 'playing' && before <= best && next.elapsedMs > best) setLiveMessage('New personal best!')
    live.current.state = next
    if (!recorded && live.current.recording !== null) live.current.recording = withFrame(live.current.recording, next, live.current.aim)
    setStateValue(next)
    if (next.events.length > 0) react(next.events, next)
  }

  /** Leaving mid-round (Back, or the screen going away) still keeps the recording. */
  function leave(): void {
    saveRecording(live.current.state, 'left')
  }

  const commitRef = useRef(commit)
  const leaveRef = useRef(leave)
  useEffect(() => {
    commitRef.current = commit
    leaveRef.current = leave
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
      leaveRef.current()
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

  function start(chosen: Loadout, grenades: number, ammo: number, best: number, armor: RoundArmor = NO_ROUND_ARMOR): void {
    // A real user gesture: create/resume the audio context here, well before the first shot.
    audio.preloadWeapon()
    audio.preloadMusic()
    const sessionId = createSessionId()
    const roster = pickRoster()
    audio.preloadZombies(roster.map((character) => character.groanSoundUrl))
    for (const cancel of timers.current) cancel()
    timers.current.clear()
    leave()
    Object.assign(live.current, { sessionId, state: null, config: null, items: new Map(), upcoming: null, lastFrameMs: null, characters: roster, bulletId: chosen.bullet.id, recording: null, previousBestMs: best })
    setPreviousBestMs(best)
    setFlags(0)
    setOutOfRounds(false)
    setShoveEarned(false)
    setCharacters(roster)
    setLoadout(chosen)
    setStateValue(null)
    setSolved([])
    setMissed([])
    setBank({ kind: 'idle' })
    setError(null)
    setArmed('shot')
    setPhase('loading')
    fetchQuestion(sessionId).then(
      ({ item, question }) => {
        if (!live.current.mounted || live.current.sessionId !== sessionId) return
        const config: HordeConfig = { durationMs: ROUND_MS, travelMs: travelMsFor(item), power: shotPower(chosen), basePower: shotPower({ ...chosen, bullet: STARTER_LOADOUT.bullet }), cooldownMs: chosen.weapon.cooldownMs, grenade: GRENADE, cover: COVER, thornsDamage: armor.thornsDamage }
        live.current.config = config
        live.current.upcoming = fetchQuestion(sessionId)
        live.current.upcoming.catch(() => undefined)
        const seed = newSeed()
        const first = setQuestion(createRound({ seed, lives: STARTING_LIVES, grenades, shoves: SHOVES_PER_ROUND, ammo: chosen.bullet.id === STARTER_LOADOUT.bullet.id ? 0 : ammo, armor: armor.charges, cover: COVER }), question)
        live.current.recording = withQuestion(
          startRecording({
            version: RECORDING_VERSION,
            sessionId,
            startedAt: nowIso(),
            seed,
            weaponId: chosen.weapon.id,
            bulletId: chosen.bullet.id,
            travelMs: config.travelMs,
            cooldownMs: config.cooldownMs,
            power: config.power,
            basePower: config.basePower,
            camera: CAMERA_POSITION,
            cover: COVER,
            characters: roster.map((character) => character.id),
          }),
          first,
          question,
        )
        commit(first)
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

  const result = state === null || state.outcome === 'playing' ? null : roundResult(state, ROUND_MS, previousBestMs)

  return {
    phase,
    state,
    characters,
    loadout,
    error,
    liveMessage,
    feedback,
    outOfRounds,
    recoilSignal,
    armed,
    audioMuted,
    solved,
    missed,
    shoveEarned,
    result,
    points: result === null ? 0 : roundPoints(result),
    bank,
    durationMs: ROUND_MS,
    previousBestMs,
    start,
    flags,
    reset: () => {
      leave()
      for (const cancel of timers.current) cancel()
      timers.current.clear()
      live.current.sessionId = ''
      live.current.state = null
      setStateValue(null)
      setOutOfRounds(false)
      setShoveEarned(false)
      setPhase('ready')
    },
    shoot: (target, detail) => {
      const current = live.current.state
      const config = live.current.config
      if (live.current.phase !== 'playing' || current === null || config === null) return
      const next = shootEngine(current, target, config)
      const recording = live.current.recording
      if (recording !== null) live.current.recording = withShot(recording, current, next, target, detail, 'shot', live.current.aim)
      if (next !== current) commit(next, true)
    },
    pushBack: () => {
      const current = live.current.state
      const config = live.current.config
      if (live.current.phase !== 'playing' || current === null || config === null) return
      const closest = closestZombie(current)
      if (closest === null) return
      const next = shoveEngine(current, closest.id, config)
      const recording = live.current.recording
      if (recording !== null) live.current.recording = withShot(recording, current, next, { zombieId: closest.id, zone: 'body' }, { aim: null, blockedBy: null, via: 'button' }, 'shove', live.current.aim)
      if (next !== current) commit(next, true)
    },
    dontKnow: () => {
      const current = live.current.state
      if (live.current.phase !== 'playing' || current === null) return
      const next = revealEngine(current)
      if (next !== current) commit(next)
    },
    endOvertime: () => {
      const current = live.current.state
      if (live.current.phase !== 'playing' || current === null || !inOvertime(current)) return
      commit(endOvertimeEngine(current))
    },
    trackAim: (aim) => {
      live.current.aim = aim
    },
    flag: () => {
      const current = live.current.state
      const recording = live.current.recording
      if (current === null || recording === null || live.current.phase !== 'playing') return
      const flagged = withFlag(recording, current, live.current.aim)
      live.current.recording = flagged
      setFlags(flagged.flags)
      setLiveMessage(`Flag ${String(flagged.flags)} marked`)
    },
    toggleGrenade: () => {
      const current = live.current.state
      if (live.current.phase !== 'playing' || current === null || current.grenades <= 0) return
      setArmed((mode) => (mode === 'grenade' ? 'shot' : 'grenade'))
    },
    throwGrenade: (at) => {
      const current = live.current.state
      const config = live.current.config
      if (live.current.phase !== 'playing' || current === null || config === null) return
      const next = throwEngine(current, at, config)
      const recording = live.current.recording
      if (recording !== null) live.current.recording = withGrenade(recording, current, next, at, live.current.aim)
      if (next === current) setArmed('shot')
      else commit(next, true)
    },
    toggleMute: () => {
      setAudioMuted(audio.toggleMuted())
    },
    sceneFailed: (err) => {
      setError(`The 3D scene couldn't load: ${errorMessage(err)}`)
    },
  }
}

/** What a gem just did, and a heads-up once the armor has no charges left. */
function armorMessage(did: string, left: Armor): string {
  return left.reflect + left.block + left.mega + left.heal === 0 ? `${did} That was your last armor gem.` : did
}

function assertNever(value: never): never {
  throw new Error(`Unexpected event: ${JSON.stringify(value)}`)
}
