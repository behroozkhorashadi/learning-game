import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import type { AttemptCreate, Item } from '../types/generated'
import { DenButton } from '../components/den/DenButton'
import { RatingPrompt } from '../components/RatingPrompt'
import { SessionComplete } from '../components/SessionComplete'
import { SessionStart } from '../components/SessionStart'
import { EquationOutbreakScene } from '../components/EquationOutbreakScene'
import { ChargeHud } from '../components/ChargeHud'
import { WeaponTuningPanel } from '../dev/WeaponTuningPanel'
import { DEFAULT_WEAPON_VIEW, type WeaponViewConfig } from '../lib/equationBlasterConfig'
import { ZOMBIE_CHARACTER_REGISTRY, type CharacterDefinition } from '../lib/characterDefinitions'
import { selectSessionRoster, shuffle } from '../lib/zombieRoster'
import { STARTER_BLASTER } from '../lib/weaponDefinitions'
import { usePrefersReducedMotion } from '../lib/reducedMotion'
import { isAudioMuted, toggleAudioMuted } from '../lib/gameAudio'
import {
  applyHit,
  canShoot,
  createWave,
  registerMiss,
  tick,
  type HitZone,
  type WaveConfig,
  type WaveState,
} from '../lib/zombieWaveEngine'

/**
 * Equation Outbreak (internal game id remains `fact_fluency` — see
 * fact_fluency.py's docstring; nothing server-side or in the wave engine is
 * renamed). A fixed-camera 3D shooting-gallery speed round: an equation
 * shows, four "zombies" (see `lib/characterDefinitions.ts` — the character
 * is a swappable definition, not hardcoded here) walk toward the camera
 * carrying candidate answers, and the player zaps the one holding the
 * correct answer before any of them arrives.
 *
 * This component is the *only* place allowed to call into
 * `zombieWaveEngine` — `EquationOutbreakScene` and its children only render
 * engine state and report raw hit/miss events up. See the engine module's
 * own docstring for the damage/telemetry/resolution rules it's authoritative
 * for.
 */

const GAME_ID = 'fact_fluency'
const SESSION_LENGTH = 5
const STARTING_LIVES = 3
// Every wave spawns exactly four carriers (zombieWaveEngine.createWave takes
// exactly four CarrierOptions from the item payload) — the roster matches
// that today. Growing the character registry past four enabled entries
// does not change this: selectSessionRoster still returns four uniques,
// chosen from whatever's enabled.
const ROSTER_SIZE = 4
const WEAPON = STARTER_BLASTER
const WRONG_HIT_SPEED_BOOST = 0.18

// A short beat where the equation fills the screen before the carriers
// spawn — gives a kid a moment to read the problem before the clock starts.
const INTRO_MS = 1100
const SOLVED_DELAY_MS = 700
const CONTACT_HOLD_MS = 700
const IMPACT_SHAKE_MS = 200
const IMPACT_SETTLE_MS = 400
const IMPACT_TO_FROZEN_MS = 800

// Transient answer-feedback vignette (green for a correct defeat, red for a
// wrong one) — fades in fast, out smooth, well within the suggested
// 350-500ms window, then this component resets it so the next hit (even
// the same kind) reliably replays rather than silently no-op'ing because
// the CSS `animation` value didn't change.
const ANSWER_FEEDBACK_MS = 420
// A wrong-answer hit gets a small, brief shake — deliberately much shorter
// (and, via wrongHitShake's smaller keyframe amplitude in index.css) much
// weaker than the player-attacked `screenShake` above, so the two never
// read as the same severity of event.
const WRONG_HIT_SHAKE_MS = 220

type Phase =
  | 'start'
  | 'intro'
  | 'playing'
  | 'contact'
  | 'impact'
  | 'life_lost_frozen'
  | 'transitioning_to_next_wave'
  | 'complete'
  | 'game_over'

type FactPayload = {
  left: number
  operator: string
  right: number
  answer: number
  options: number[]
  approach_ms: number
}

function factPayload(item: Item): FactPayload {
  return item.payload as unknown as FactPayload
}

function factText(payload: FactPayload): string {
  return `${payload.left} ${payload.operator} ${payload.right} = ${payload.answer}`
}

/** `?debugLanes=1`, dev-build-only — shows `LaneDebugOverlay`'s navigation
 * and collision wireframes. Never true in a production build, regardless
 * of URL, since `import.meta.env.DEV` is statically false there. Read once
 * at module scope rather than via a hook — this is a static dev toggle for
 * the whole session, not state that changes while playing. */
const DEBUG_LANES_ENABLED = import.meta.env.DEV && new URLSearchParams(window.location.search).get('debugLanes') === '1'

/** `?tuneWeapon=1`, dev-build-only — shows `WeaponTuningPanel` for live
 * weapon/arm pose tuning in the actual first-person view. Same rationale as
 * `DEBUG_LANES_ENABLED` above. Extracted as a pure function (rather than
 * inlined the way `DEBUG_LANES_ENABLED` is) so a test can directly verify
 * "never enabled outside dev, regardless of the URL" without needing to
 * fight `import.meta.env` at the module-load level. */
export function isWeaponTuningEnabled(isDev: boolean, search: string): boolean {
  return isDev && new URLSearchParams(search).get('tuneWeapon') === '1'
}

const WEAPON_TUNING_ENABLED = isWeaponTuningEnabled(import.meta.env.DEV, window.location.search)

function buildConfig(item: Item): WaveConfig {
  const payload = factPayload(item)
  return {
    approachMs: payload.approach_ms,
    wrongHitSpeedBoost: WRONG_HIT_SPEED_BOOST,
    cockingMs: WEAPON.cockingMs,
  }
}

/** The three distinct visual-feedback outcomes a resolved shot or a player
 * attack can produce — kept as a discrete, typed event (with an
 * incrementing `id`) rather than a shared boolean so React effects can
 * trigger exactly once per event and never get replayed by an unrelated
 * render, and so "correct" and "wrong" can never be confused for one
 * another the way a single ambiguous flag would allow. */
type FeedbackKind = 'correctHit' | 'wrongHit' | 'playerAttacked'
interface FeedbackEvent {
  kind: FeedbackKind
  id: number
}

interface Props {
  profileId: number
  profileName?: string
  onBack: () => void
}

export function ZombieMathBlaster({ profileId, onBack }: Props) {
  const [phase, setPhase] = useState<Phase>('start')
  const [item, setItem] = useState<Item | null>(null)
  const [wave, setWave] = useState<WaveState | null>(null)
  const [lives, setLives] = useState(STARTING_LIVES)
  const [solvedFacts, setSolvedFacts] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [ratingHandled, setRatingHandled] = useState(false)
  const [sessionId, setSessionId] = useState<string>(() => crypto.randomUUID())
  const [aimNdc, setAimNdc] = useState<{ x: number; y: number } | null>(null)
  const [recoilSignal, setRecoilSignal] = useState(0)
  const [liveMessage, setLiveMessage] = useState('')
  // This wave's character for each lane (index 0..3) — a shuffled view of
  // the session roster below, recomputed once per wave (not per render).
  const [waveCharacters, setWaveCharacters] = useState<CharacterDefinition[]>([])
  // The current transient answer-feedback pulse (correctHit/wrongHit) or
  // the player-attacked event — see `triggerFeedback` and the effect that
  // clears this back to null after ANSWER_FEEDBACK_MS.
  const [feedbackEvent, setFeedbackEvent] = useState<FeedbackEvent | null>(null)
  const [audioMuted, setAudioMuted] = useState(() => isAudioMuted())
  // Only ever read/rendered when WEAPON_TUNING_ENABLED — see WeaponTuningPanel.
  const [weaponView, setWeaponView] = useState<WeaponViewConfig>(DEFAULT_WEAPON_VIEW)
  const [hideRightArmTuning, setHideRightArmTuning] = useState(false)
  const [hideLeftArmTuning, setHideLeftArmTuning] = useState(false)

  const reducedMotion = usePrefersReducedMotion()

  const phaseRef = useRef(phase)
  const feedbackIdRef = useRef(0)
  // The four characters for the whole session — selected once per session
  // (see `startSession`), reused by every wave in it. A ref, not state:
  // nothing renders directly from this — only `waveCharacters` (its
  // per-wave lane shuffle) is ever passed to the scene.
  const rosterRef = useRef<CharacterDefinition[]>([])
  const waveRef = useRef<WaveState | null>(null)
  const configRef = useRef<WaveConfig>({
    approachMs: 6000,
    wrongHitSpeedBoost: WRONG_HIT_SPEED_BOOST,
    cockingMs: WEAPON.cockingMs,
  })
  const lastFrameRef = useRef<number | null>(null)
  const handledOutcomeRef = useRef(false)
  const fetchedForSessionRef = useRef<string | null>(null)
  const resultPanelRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    phaseRef.current = phase
  }, [phase])
  useEffect(() => {
    waveRef.current = wave
  }, [wave])

  function triggerFeedback(kind: FeedbackKind) {
    feedbackIdRef.current += 1
    setFeedbackEvent({ kind, id: feedbackIdRef.current })
  }

  // Auto-clears every feedback event after its pulse duration — this is
  // also what makes the *next* event reliably replay even when it's the
  // same kind as the last one: the CSS `animation` values below are only
  // guaranteed to restart when they actually change, and resetting to null
  // in between guarantees that, rather than risking two consecutive
  // `wrongHit`s (e.g. across two different waves) silently sharing one
  // stale animation string.
  useEffect(() => {
    if (!feedbackEvent) return
    const timer = setTimeout(() => setFeedbackEvent(null), ANSWER_FEEDBACK_MS)
    return () => clearTimeout(timer)
  }, [feedbackEvent])

  // Fires the correct/wrong answer-feedback pulse for every resolved hit —
  // `wave.lastHit` is itself already a one-render pulse (zombieWaveEngine's
  // `tick` clears it back to null on the very next frame), so this effect
  // naturally fires exactly once per hit and is never replayed by an
  // unrelated render of the same `wave` object.
  useEffect(() => {
    if (!wave?.lastHit) return
    if (wave.lastHit.correct) {
      triggerFeedback('correctHit')
      return
    }
    // A wrong defeat that *also* ends the wave (the second wrong carrier)
    // is already about to get the stronger life-lost overlay from the
    // wave-outcome effect below — firing the small wrongHit pulse too would
    // layer two reds and two shakes on top of each other. Only a wrong
    // defeat that leaves the wave pending gets its own standalone pulse.
    if (wave.outcome === 'pending') {
      triggerFeedback('wrongHit')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wave?.lastHit])

  const fetchItem = useCallback(async () => {
    setError(null)
    try {
      const res = await fetch(`/api/items/next?profile_id=${profileId}&game_id=${GAME_ID}&session_id=${sessionId}`)
      if (!res.ok) throw new Error(`GET /api/items/next -> ${res.status}`)
      const next: Item = await res.json()
      setItem(next)
      configRef.current = buildConfig(next)
      setWave(null)
      waveRef.current = null
      handledOutcomeRef.current = false
      setPhase('intro')
    } catch (err) {
      setError(String(err))
    }
  }, [profileId, sessionId])

  useEffect(() => {
    if (phase !== 'playing' && phase !== 'intro') return
    if (fetchedForSessionRef.current === sessionId) return
    fetchedForSessionRef.current = sessionId
    fetchItem()
  }, [phase, sessionId, fetchItem])

  // Intro beat: show the full equation, then spawn the wave.
  useEffect(() => {
    if (phase !== 'intro' || !item) return
    const timer = setTimeout(() => {
      const payload = factPayload(item)
      const options = payload.options.map((value, i) => ({ id: `${item.item_id}-${i}`, value, correct: value === payload.answer }))
      const newWave = createWave(options)
      lastFrameRef.current = null
      waveRef.current = newWave
      setWave(newWave)
      // One instance of each roster member every wave — shuffling only
      // decides which lane each sits in, never which four characters
      // appear (that's fixed for the whole session; see `startSession`).
      setWaveCharacters(shuffle(rosterRef.current))
      setPhase('playing')
    }, INTRO_MS)
    return () => clearTimeout(timer)
  }, [phase, item])

  // Single persistent animation loop for the whole component lifetime.
  useEffect(() => {
    let rafId: number
    function frame(now: number) {
      rafId = requestAnimationFrame(frame)
      const current = waveRef.current
      if (phaseRef.current !== 'playing' || !current || current.outcome !== 'pending') {
        lastFrameRef.current = null
        return
      }
      if (lastFrameRef.current == null) {
        lastFrameRef.current = now
        return
      }
      const dt = now - lastFrameRef.current
      lastFrameRef.current = now
      const nextWave = tick(current, dt, configRef.current)
      waveRef.current = nextWave
      setWave(nextWave)
    }
    rafId = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(rafId)
  }, [])

  const postAttempt = useCallback(
    async (correct: boolean, wrongShots: number, timeMs: number) => {
      if (!item) return
      const payload: AttemptCreate = {
        item_id: item.item_id,
        profile_id: profileId,
        game_id: item.game_id,
        session_id: sessionId,
        telemetry: { correct, hints_used: wrongShots, time_ms: Math.round(timeMs) },
        details: { wrong_shots: wrongShots },
      }
      try {
        const res = await fetch('/api/attempts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error(`POST /api/attempts -> ${res.status}`)
      } catch (err) {
        setError(String(err))
      }
    },
    [item, profileId, sessionId],
  )

  // Handles a wave finishing, in any of the three directions the engine can
  // resolve it: correct, player contact, or second-wrong-carrier defeat.
  // Fires exactly once per wave (guarded by handledOutcomeRef).
  useEffect(() => {
    if (!wave || !item || wave.outcome === 'pending') return
    if (handledOutcomeRef.current) return
    handledOutcomeRef.current = true

    const payload = factPayload(item)
    const text = factText(payload)

    if (wave.outcome === 'solved') {
      postAttempt(true, wave.wrongShots, wave.elapsedMs)
      setLiveMessage(`Correct! ${text}`)
      const timer = setTimeout(() => {
        setSolvedFacts((prev) => {
          const nextList = [...prev, text]
          if (nextList.length >= SESSION_LENGTH) {
            setPhase('complete')
          } else {
            setPhase('transitioning_to_next_wave')
            fetchItem()
          }
          return nextList
        })
      }, SOLVED_DELAY_MS)
      return () => clearTimeout(timer)
    }

    // life_lost: either player contact or second-wrong-carrier defeat.
    postAttempt(false, wave.wrongShots, wave.elapsedMs)
    if (wave.resolutionReason === 'player_contact') {
      setPhase('contact')
      setLiveMessage('A zombie got through!')
      // The strong overlay/shake this drives is the existing phase-based
      // `impact`/`life_lost_frozen` rendering below, not the transient
      // correctHit/wrongHit pulse — firing the typed event here is purely
      // so "what just happened" is represented consistently for all three
      // kinds, not just the two auto-clearing ones.
      triggerFeedback('playerAttacked')
      const timer = setTimeout(() => setPhase('impact'), CONTACT_HOLD_MS)
      return () => clearTimeout(timer)
    }
    setPhase('impact')
    setLiveMessage('Too many wrong targets!')
    return undefined
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wave?.outcome])

  // impact -> life_lost_frozen, decrementing lives exactly once.
  const livesDecrementedRef = useRef(false)
  useEffect(() => {
    if (phase !== 'impact') {
      livesDecrementedRef.current = false
      return
    }
    if (livesDecrementedRef.current) return
    livesDecrementedRef.current = true
    const timer = setTimeout(() => {
      setLives((prev) => {
        const remaining = prev - 1
        setPhase(remaining <= 0 ? 'game_over' : 'life_lost_frozen')
        return Math.max(remaining, 0)
      })
    }, IMPACT_TO_FROZEN_MS)
    return () => clearTimeout(timer)
  }, [phase])

  // Move focus into the frozen result panel once it appears.
  useEffect(() => {
    if (phase === 'life_lost_frozen') {
      resultPanelRef.current?.focus()
    }
  }, [phase])

  function handleHit(carrierId: string, zone: HitZone) {
    if (!waveRef.current) return
    if (!canShoot(waveRef.current, configRef.current)) return
    const before = waveRef.current
    const next = applyHit(before, carrierId, zone, configRef.current)
    if (next === before) return
    setRecoilSignal((n) => n + 1)
    waveRef.current = next
    setWave(next)
  }

  function handleMiss() {
    if (!waveRef.current) return
    if (!canShoot(waveRef.current, configRef.current)) return
    const before = waveRef.current
    const next = registerMiss(before, configRef.current)
    if (next === before) return
    setRecoilSignal((n) => n + 1)
    waveRef.current = next
    setWave(next)
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType === 'touch') return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1
    const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1)
    setAimNdc({ x, y })
  }

  function startSession() {
    setLives(STARTING_LIVES)
    setSolvedFacts([])
    setRatingHandled(false)
    fetchedForSessionRef.current = null
    // A brand-new session (first Start, or Try Again via playAgainSession)
    // always gets a fresh random roster — see the module docstring in
    // lib/zombieRoster.ts. Moving to the next question never calls this.
    rosterRef.current = selectSessionRoster(ZOMBIE_CHARACTER_REGISTRY, ROSTER_SIZE)
    setPhase('playing')
  }

  function handleToggleMute() {
    setAudioMuted(toggleAudioMuted())
  }

  function playAgainSession() {
    setSessionId(crypto.randomUUID())
    startSession()
  }

  function handleNextQuestion() {
    setPhase('transitioning_to_next_wave')
    fetchItem()
  }

  function submitRating(value: number) {
    setRatingHandled(true)
    fetch('/api/ratings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile_id: profileId, game_id: GAME_ID, scale: 'stars_1_5', value }),
    }).catch((err) => setError(String(err)))
  }

  const inputEnabled = phase === 'playing'
  const wavePhaseForScene = phase === 'intro' ? 'intro' : 'playing'

  // The container only ever needs one active shake at a time — a wrong hit
  // that also ends the wave never reaches this as `wrongHit` (see the
  // lastHit effect above), so `phase === 'impact'` and a live `wrongHit`
  // event never overlap in practice.
  const containerAnimation = reducedMotion
    ? 'none'
    : phase === 'impact'
      ? `screenShake ${IMPACT_SHAKE_MS + IMPACT_SETTLE_MS}ms ease-out`
      : feedbackEvent?.kind === 'wrongHit'
        ? `wrongHitShake ${WRONG_HIT_SHAKE_MS}ms ease-out`
        : 'none'

  // The live 3D gameplay view fills the whole browser window edge to edge;
  // the start/complete/game-over cards are regular centered UI, not "the
  // game" itself, so they keep a comfortable padded/centered layout instead.
  const isGamePhase = phase !== 'start' && phase !== 'complete' && phase !== 'game_over' && phase !== 'transitioning_to_next_wave'

  return (
    <div style={{ width: '100%', height: '100vh', boxSizing: 'border-box', background: 'var(--surface-app)', overflow: 'hidden', display: 'flex' }}>
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          ...(isGamePhase ? {} : { padding: '32px 24px 56px', alignItems: 'center', justifyContent: 'center', overflowY: 'auto' }),
        }}
      >
        {error && <pre style={{ color: '#CD2A20', background: '#FDF2F2', padding: 12, borderRadius: 12 }}>Error: {error}</pre>}

        <div aria-live="assertive" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
          {liveMessage}
        </div>

        {phase === 'start' && (
          <SessionStart
            eyebrow="Speed round"
            headline="Equation Outbreak"
            subtitle="Solve the facts. Stop the horde. An equation shows up, then a horde of silly zombies shambles toward you carrying possible answers. Zap the right one with your math blaster before they arrive — a wrong zap makes them faster!"
            sessionLength={SESSION_LENGTH}
            heroSrc={`/images/badges/${GAME_ID}.png`}
            onStart={startSession}
            onBack={onBack}
          />
        )}

        {isGamePhase && item && (
          <div
            ref={containerRef}
            data-testid="game-container"
            onPointerMove={handlePointerMove}
            style={{
              position: 'relative',
              overflow: 'hidden',
              flex: 1,
              width: '100%',
              minHeight: 0,
              cursor: aimNdc ? 'none' : 'crosshair',
              outline: 'none',
              animation: containerAnimation,
            }}
          >
            <Canvas shadows={!reducedMotion} onPointerMissed={handleMiss}>
              <Suspense fallback={null}>
                <EquationOutbreakScene
                  carriers={wave?.carriers ?? []}
                  charactersByLane={waveCharacters}
                  weapon={WEAPON}
                  phase={wavePhaseForScene}
                  speedMultiplier={wave?.speedMultiplier ?? 1}
                  aimNdc={aimNdc}
                  reducedMotion={reducedMotion}
                  recoilSignal={recoilSignal}
                  weaponPhase={wave?.weaponPhase ?? 'readyFirstShot'}
                  cockingUntilMs={wave?.cockingUntilMs ?? null}
                  elapsedMs={wave?.elapsedMs ?? 0}
                  cockingMs={WEAPON.cockingMs}
                  onHit={handleHit}
                  onMiss={handleMiss}
                  debugLanes={DEBUG_LANES_ENABLED}
                  weaponView={WEAPON_TUNING_ENABLED ? weaponView : undefined}
                  hideRightArm={WEAPON_TUNING_ENABLED && hideRightArmTuning}
                  hideLeftArm={WEAPON_TUNING_ENABLED && hideLeftArmTuning}
                />
              </Suspense>
            </Canvas>

            {WEAPON_TUNING_ENABLED && (
              <WeaponTuningPanel
                value={weaponView}
                onChange={setWeaponView}
                hideRightArm={hideRightArmTuning}
                onHideRightArmChange={setHideRightArmTuning}
                hideLeftArm={hideLeftArmTuning}
                onHideLeftArmChange={setHideLeftArmTuning}
              />
            )}

            {/* HUD overlay */}
            <div style={{ position: 'absolute', top: 16, left: 16, right: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', zIndex: 200, pointerEvents: 'none' }}>
              <span style={{ pointerEvents: 'auto' }}>
                <DenButton label="Back" variant="quiet" shape="pill" size="md" iconOnly boxSize={44} iconPaths={['M10.25 6.75L4.75 12L10.25 17.25M19.25 12H5']} onClick={onBack} />
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ pointerEvents: 'auto' }}>
                  <ChargeHud shotsRemaining={wave?.shotsRemaining ?? 2} weaponPhase={wave?.weaponPhase ?? 'readyFirstShot'} reducedMotion={reducedMotion} />
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: 40, padding: '0 14px', borderRadius: 9999, background: 'rgba(255,255,255,0.9)', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 16, color: '#2A2E37' }}>
                  {solvedFacts.length} / {SESSION_LENGTH}
                </div>
                <div style={{ fontSize: 22 }} aria-label={`${lives} lives left`}>
                  {'❤️'.repeat(Math.max(lives, 0))}
                </div>
                <span style={{ pointerEvents: 'auto' }}>
                  <DenButton
                    label={audioMuted ? 'Unmute' : 'Mute'}
                    variant="quiet"
                    shape="pill"
                    size="md"
                    iconOnly
                    boxSize={44}
                    onClick={handleToggleMute}
                    iconPaths={
                      audioMuted
                        ? ['M4.75 9.75H8L13.25 5V19L8 14.25H4.75V9.75Z', 'M17 8.5L21 15.5M21 8.5L17 15.5']
                        : ['M4.75 9.75H8L13.25 5V19L8 14.25H4.75V9.75Z', 'M17 9C17.8 9.7 18.25 10.8 18.25 12C18.25 13.2 17.8 14.3 17 15']
                    }
                  />
                </span>
              </div>
            </div>

            {item && (
              <div
                style={{
                  position: 'absolute',
                  left: '50%',
                  transform: wavePhaseForScene === 'intro' ? 'translate(-50%, -50%) scale(1.4)' : 'translate(-50%, 0) scale(1)',
                  top: wavePhaseForScene === 'intro' ? '50%' : 64,
                  transition: 'top 500ms cubic-bezier(0.2,0,0,1), transform 500ms cubic-bezier(0.2,0,0,1)',
                  zIndex: 150,
                  padding: '14px 24px',
                  borderRadius: 20,
                  background: '#FFFFFF',
                  boxShadow: '0 10px 24px -12px rgba(0,13,51,0.35)',
                  fontFamily: 'var(--font-display)',
                  fontWeight: 800,
                  fontSize: 34,
                  color: '#2A2E37',
                  whiteSpace: 'nowrap',
                  pointerEvents: 'none',
                }}
              >
                {factPayload(item).left} {factPayload(item).operator} {factPayload(item).right} =
              </div>
            )}

            {/* accessible answer list — mirrors the visual targets for
             * screen-reader users, independent of the canvas */}
            <div style={{ position: 'absolute', bottom: 12, left: 16, right: 16, zIndex: 200, display: 'flex', gap: 8, flexWrap: 'wrap', pointerEvents: inputEnabled ? 'auto' : 'none' }}>
              {(wave?.carriers ?? []).map((carrier) =>
                carrier.status === 'active' ? (
                  <button
                    key={carrier.id}
                    onClick={() => handleHit(carrier.id, 'body')}
                    aria-label={`Zap the zombie carrying ${carrier.value}`}
                    style={{
                      height: 36,
                      padding: '0 12px',
                      borderRadius: 9999,
                      border: '1px solid rgba(255,255,255,0.5)',
                      background: 'rgba(0,0,0,0.35)',
                      color: '#FFFFFF',
                      fontFamily: 'var(--font-display)',
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: 'pointer',
                    }}
                  >
                    {carrier.value}
                  </button>
                ) : null,
              )}
            </div>

            {/* Transient correct/wrong answer-feedback vignette — color
             * restricted to the outer edge (a wide transparent center) so
             * it never obscures the equation, answer labels, or the
             * zombie's own defeat animation. Remounted via `key` on every
             * new event so the fade-in/out replays even for two
             * consecutive events of the same kind. Deliberately excludes
             * `playerAttacked`, which keeps using the stronger, persistent
             * overlay below instead of this short pulse. */}
            {feedbackEvent && (feedbackEvent.kind === 'correctHit' || feedbackEvent.kind === 'wrongHit') && (
              <div
                key={feedbackEvent.id}
                aria-hidden="true"
                data-testid="answer-feedback-vignette"
                data-feedback-kind={feedbackEvent.kind}
                data-feedback-id={feedbackEvent.id}
                style={{
                  position: 'absolute',
                  inset: 0,
                  zIndex: 205,
                  pointerEvents: 'none',
                  background:
                    feedbackEvent.kind === 'correctHit'
                      ? 'radial-gradient(ellipse at center, transparent 58%, rgba(34,197,94,0.6) 100%)'
                      : 'radial-gradient(ellipse at center, transparent 55%, rgba(205,42,32,0.5) 100%)',
                  animation: `vignettePulse ${ANSWER_FEEDBACK_MS}ms ease-out`,
                }}
              />
            )}

            {aimNdc && (
              <div
                style={{
                  position: 'absolute',
                  left: `${((aimNdc.x + 1) / 2) * 100}%`,
                  top: `${((1 - aimNdc.y) / 2) * 100}%`,
                  transform: 'translate(-50%, -50%)',
                  pointerEvents: 'none',
                  zIndex: 210,
                  width: 36,
                  height: 36,
                  borderRadius: 9999,
                  border: '2.5px solid #FFFFFF',
                }}
              />
            )}

            {(phase === 'impact' || phase === 'life_lost_frozen') && (
              <div
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  inset: 0,
                  zIndex: 220,
                  pointerEvents: 'none',
                  background: 'radial-gradient(ellipse at center, transparent 45%, rgba(205,42,32,0.55) 100%)',
                  transition: `opacity ${reducedMotion ? 150 : 400}ms ease`,
                }}
              />
            )}

            {phase === 'life_lost_frozen' && (
              <div
                ref={resultPanelRef}
                tabIndex={-1}
                role="dialog"
                aria-label="Round result"
                style={{
                  position: 'absolute',
                  inset: 0,
                  zIndex: 230,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(20,10,10,0.45)',
                }}
              >
                <div style={{ background: '#FFF6EA', borderRadius: 28, padding: '32px 36px', maxWidth: 420, textAlign: 'center', boxShadow: '0 22px 44px -16px rgba(0,13,51,0.4)' }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 26, color: '#2A2E37', marginBottom: 10 }}>
                    {wave?.resolutionReason === 'player_contact' ? 'A zombie got through!' : 'Too many wrong targets!'}
                  </div>
                  <p style={{ color: '#8896AA', fontSize: 15, marginBottom: 6 }}>
                    Lives left: {lives} · Score: {solvedFacts.length}/{SESSION_LENGTH}
                  </p>
                  <p style={{ color: '#8896AA', fontSize: 15, marginBottom: 20 }}>Take a breath—you've got another chance.</p>
                  <DenButton label="Next Question" variant="blue" shape="pill" size="lg" lipColor="#0037DB" onClick={handleNextQuestion} />
                </div>
              </div>
            )}
          </div>
        )}

        {phase === 'transitioning_to_next_wave' && <p style={{ color: 'var(--fg-tertiary)', textAlign: 'center' }}>Loading the next equation…</p>}

        {phase === 'complete' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {!ratingHandled && <RatingPrompt onRate={submitRating} onDismiss={() => setRatingHandled(true)} />}
            <SessionComplete
              headline="You stopped the Equation Outbreak!"
              subtitle="Five facts, solved under pressure. Nice reflexes."
              badgeSrc={`/images/badges/${GAME_ID}.png`}
              badgeTitle="Fact Blaster badge"
              words={solvedFacts}
              itemsLabel="Facts you zapped"
              onPlayAgain={playAgainSession}
              onAllDone={onBack}
            />
          </div>
        )}

        {phase === 'game_over' && (
          <div
            style={{
              position: 'relative',
              background: '#FFF6EA',
              border: '1px solid #F1ECE0',
              borderRadius: 32,
              padding: '48px 40px 44px',
              textAlign: 'center',
              boxShadow: '0 22px 44px -16px rgba(0,13,51,0.14)',
            }}
          >
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.09em', textTransform: 'uppercase', fontWeight: 700, color: '#98A2B3', marginBottom: 10 }}>
              Speed round
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 36, color: '#2A2E37', marginBottom: 10 }}>
              The outbreak got the better of you this time!
            </div>
            <p style={{ color: '#8896AA', fontSize: 17, marginBottom: 8 }}>
              You solved {solvedFacts.length} of {SESSION_LENGTH} before that happened. Give it another go?
            </p>
            {solvedFacts.length > 0 && (
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', margin: '18px 0' }}>
                {solvedFacts.map((fact, i) => (
                  <span key={i} style={{ display: 'inline-flex', alignItems: 'center', height: 38, padding: '0 14px', borderRadius: 9999, background: '#FFFFFF', border: '1px solid #EEE4D2', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 15, color: '#2A2E37' }}>
                    {fact}
                  </span>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginTop: 20 }}>
              <DenButton label="Back" variant="quiet" shape="pill" size="lg" onClick={onBack} />
              <DenButton label="Try again" variant="blue" shape="pill" size="lg" lipColor="#0037DB" onClick={playAgainSession} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
