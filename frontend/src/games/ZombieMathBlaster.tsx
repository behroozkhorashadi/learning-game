import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import type { AttemptCreate, Item } from '../types/generated'
import { DenButton } from '../components/den/DenButton'
import { RatingPrompt } from '../components/RatingPrompt'
import { SessionComplete } from '../components/SessionComplete'
import { SessionStart } from '../components/SessionStart'
import { EquationOutbreakScene } from '../components/EquationOutbreakScene'
import { SCIENTIST_ZOMBIE } from '../lib/characterDefinitions'
import { STARTER_BLASTER } from '../lib/weaponDefinitions'
import { usePrefersReducedMotion } from '../lib/reducedMotion'
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
const CHARACTER = SCIENTIST_ZOMBIE
const WEAPON = STARTER_BLASTER
const WRONG_HIT_SPEED_BOOST = 0.18
// How much a non-final body shot pushes the hit zombie back along its lane,
// as a fraction of the full spawn-to-danger-line approach distance. Chosen
// to read clearly as a knockback without meaningfully extending the round —
// tune here if playtesting says otherwise.
const BODY_SHOT_KNOCKBACK = 0.06

// A short beat where the equation fills the screen before the carriers
// spawn — gives a kid a moment to read the problem before the clock starts.
const INTRO_MS = 1100
const SOLVED_DELAY_MS = 700
const CONTACT_HOLD_MS = 700
const IMPACT_SHAKE_MS = 200
const IMPACT_SETTLE_MS = 400
const IMPACT_TO_FROZEN_MS = 800

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

function buildConfig(item: Item): WaveConfig {
  const payload = factPayload(item)
  return {
    approachMs: payload.approach_ms,
    wrongHitSpeedBoost: WRONG_HIT_SPEED_BOOST,
    shotCooldownMs: WEAPON.shotCooldownMs,
    bodyShotKnockback: BODY_SHOT_KNOCKBACK,
  }
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

  const reducedMotion = usePrefersReducedMotion()

  const phaseRef = useRef(phase)
  const waveRef = useRef<WaveState | null>(null)
  const configRef = useRef<WaveConfig>({
    approachMs: 6000,
    wrongHitSpeedBoost: WRONG_HIT_SPEED_BOOST,
    shotCooldownMs: WEAPON.shotCooldownMs,
    bodyShotKnockback: BODY_SHOT_KNOCKBACK,
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
    setPhase('playing')
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

  return (
    <div style={{ minHeight: '100%', boxSizing: 'border-box', background: 'var(--surface-app)', display: 'flex', justifyContent: 'center', padding: '32px 24px 56px' }}>
      <div style={{ width: '100%', maxWidth: 'min(1600px, 70vw)', minWidth: 320, display: 'flex', flexDirection: 'column' }}>
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

        {phase !== 'start' && phase !== 'complete' && phase !== 'game_over' && phase !== 'transitioning_to_next_wave' && item && (
          <div
            ref={containerRef}
            onPointerMove={handlePointerMove}
            style={{
              position: 'relative',
              borderRadius: 24,
              overflow: 'hidden',
              aspectRatio: '900 / 560',
              maxHeight: '75vh',
              border: '1px solid var(--border-subtle)',
              boxShadow: 'var(--elevation-300)',
              cursor: aimNdc ? 'none' : 'crosshair',
              outline: 'none',
              animation: phase === 'impact' && !reducedMotion ? `screenShake ${IMPACT_SHAKE_MS + IMPACT_SETTLE_MS}ms ease-out` : 'none',
            }}
          >
            <Canvas shadows={!reducedMotion} onPointerMissed={handleMiss}>
              <Suspense fallback={null}>
                <EquationOutbreakScene
                  carriers={wave?.carriers ?? []}
                  character={CHARACTER}
                  weapon={WEAPON}
                  phase={wavePhaseForScene}
                  speedMultiplier={wave?.speedMultiplier ?? 1}
                  lastHit={wave?.lastHit ?? null}
                  aimNdc={aimNdc}
                  reducedMotion={reducedMotion}
                  recoilSignal={recoilSignal}
                  onHit={handleHit}
                  onMiss={handleMiss}
                  debugLanes={DEBUG_LANES_ENABLED}
                />
              </Suspense>
            </Canvas>

            {/* HUD overlay */}
            <div style={{ position: 'absolute', top: 16, left: 16, right: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', zIndex: 200, pointerEvents: 'none' }}>
              <span style={{ pointerEvents: 'auto' }}>
                <DenButton label="Back" variant="quiet" shape="pill" size="md" iconOnly boxSize={44} iconPaths={['M10.25 6.75L4.75 12L10.25 17.25M19.25 12H5']} onClick={onBack} />
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: 40, padding: '0 14px', borderRadius: 9999, background: 'rgba(255,255,255,0.9)', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 16, color: '#2A2E37' }}>
                  {solvedFacts.length} / {SESSION_LENGTH}
                </div>
                <div style={{ fontSize: 22 }} aria-label={`${lives} lives left`}>
                  {'❤️'.repeat(Math.max(lives, 0))}
                </div>
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
