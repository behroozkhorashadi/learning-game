import type { ComponentType, ReactElement } from 'react'
import type { OutbreakViewportProps } from '@app/arena/outbreak_viewport.pure.ui.tsx'
import { ChargeHud } from '@app/blaster/charge_hud.pure.ui.tsx'
import { WeaponTuningPanel } from '@app/blaster/weapon_tuning_panel.pure.ui.tsx'
import { DenButton } from '@app/den/den_button.pure.ui.tsx'
import { GameVolumeControl } from '@app/den/game_volume_control.pure.ui.tsx'
import { usePrefersReducedMotion, type MotionPreference } from '@app/motion/use_prefers_reduced_motion.pure.hook.ts'
import { RatingPrompt } from '@app/session/rating_prompt.pure.ui.tsx'
import { SessionComplete } from '@app/session/session_complete.pure.ui.tsx'
import { SessionStart } from '@app/session/session_start.pure.ui.tsx'
import type { ReadAloud } from '@app/speech/speech_state.pure.lib.ts'
import { useReadAloud } from '@app/speech/use_read_aloud.pure.hook.ts'
import { ArenaPerformanceSummary } from './arena_performance_summary.pure.ui.tsx'
import { containerAnimation, isGamePhase, ANSWER_FEEDBACK_MS } from './arena_session.pure.lib.ts'
import { useArenaSession, type ArenaSessionDeps } from './use_arena_session.pure.hook.ts'
import type { ArenaDebug } from './zombie_arena_state.pure.lib.ts'

/**
 * The reusable "zombie box": a fixed-camera 3D shooting-gallery speed round.
 * A question shows, four zombies walk toward the camera carrying candidate
 * answers, and the player zaps the one holding the right answer before any
 * of them arrives. What the question is and how a round is scored is the
 * brain's (zombie_arena_state); this screen owns the round and session
 * lifecycle (use_arena_session), the HUD, and the overlays, identically for
 * every game built on it.
 *
 * The 3D view is injected (`Viewport`), so this screen is tested with a plain
 * DOM stand-in, no WebGL.
 */

export interface ZombieArenaProps {
  readonly profileId: number
  readonly onBack: () => void
}

export interface ZombieArenaDeps extends ArenaSessionDeps {
  /** The 3D view. In the app, arena/outbreak_viewport.pure.ui.tsx. */
  readonly Viewport: ComponentType<OutbreakViewportProps>
  readonly motion: MotionPreference
  readonly debug: ArenaDebug
  /** Reads the instructions aloud, and stops them. */
  readonly readAloud: ReadAloud
  /** For the dev weapon tuning panel's "copy config". */
  readonly copyText: (text: string) => Promise<void>
}

const BACK_ICON = ['M10.25 6.75L4.75 12L10.25 17.25M19.25 12H5']

export function bindZombieArena(deps: ZombieArenaDeps): ComponentType<ZombieArenaProps> {
  const { brain, weapon, Viewport, motion, debug, readAloud, copyText } = deps

  function ZombieArena({ profileId, onBack }: ZombieArenaProps): ReactElement {
    const session = useArenaSession(deps, profileId)
    const reducedMotion = usePrefersReducedMotion(motion)
    const { phase, question, wave, feedback } = session
    const inputEnabled = phase === 'playing'
    const wavePhase = phase === 'intro' ? 'intro' : 'playing'
    const gameView = isGamePhase(phase)
    const instructions = useReadAloud(readAloud, brain.copy.subtitle, phase === 'start')

    return (
      <div style={{ width: '100%', height: '100vh', boxSizing: 'border-box', background: 'var(--surface-app)', overflow: 'hidden', display: 'flex' }}>
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            // The live 3D view fills the window edge to edge; the start/complete/game-over cards are regular centred UI.
            ...(gameView ? {} : { padding: '32px 24px 56px', alignItems: 'center', justifyContent: 'center', overflowY: 'auto' }),
          }}
        >
          {session.error !== null && (
            <pre role="alert" style={{ color: '#CD2A20', background: '#FDF2F2', padding: 12, borderRadius: 12 }}>
              Error: {session.error}
            </pre>
          )}

          <div aria-live="assertive" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
            {session.liveMessage}
          </div>

          {phase === 'start' && (
            <SessionStart
              eyebrow="Speed round"
              headline={brain.copy.title}
              subtitle={brain.copy.subtitle}
              readingInstructions={instructions.reading}
              onHearInstructions={instructions.toggle}
              sessionLength={brain.sessionLength}
              heroSrc={`/images/badges/${brain.gameId}.png`}
              onStart={session.start}
              onBack={onBack}
            />
          )}

          {gameView && question !== null && (
            <div
              role="application"
              aria-label="Zombie arena"
              onPointerMove={session.aim}
              style={{ position: 'relative', overflow: 'hidden', flex: 1, width: '100%', minHeight: 0, cursor: session.aimNdc ? 'none' : 'crosshair', outline: 'none', animation: containerAnimation(phase, feedback, reducedMotion) }}
            >
              <Viewport
                shadows={!reducedMotion}
                onSceneError={session.sceneFailed}
                carriers={wave?.carriers ?? []}
                charactersByLane={session.waveCharacters}
                weapon={weapon}
                phase={wavePhase}
                speedMultiplier={wave?.speedMultiplier ?? 1}
                aimNdc={session.aimNdc}
                reducedMotion={reducedMotion}
                recoilSignal={session.recoilSignal}
                weaponPhase={wave?.weaponPhase ?? 'readyFirstShot'}
                cockingUntilMs={wave?.cockingUntilMs ?? null}
                elapsedMs={wave?.elapsedMs ?? 0}
                cockingMs={weapon.cockingMs}
                onHit={session.hit}
                onMiss={session.miss}
                onReloadStart={deps.audio.playReload}
                debugLanes={debug.lanes}
                weaponView={debug.weaponTuning ? session.weaponView : undefined}
                hideRightArm={debug.weaponTuning && session.hideRightArm}
                hideLeftArm={debug.weaponTuning && session.hideLeftArm}
              />

              {debug.weaponTuning && (
                <WeaponTuningPanel
                  value={session.weaponView}
                  onChange={session.setWeaponView}
                  hideRightArm={session.hideRightArm}
                  onHideRightArmChange={session.setHideRightArm}
                  hideLeftArm={session.hideLeftArm}
                  onHideLeftArmChange={session.setHideLeftArm}
                  copyText={copyText}
                />
              )}

              <div style={{ position: 'absolute', top: 16, left: 16, right: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', zIndex: 200, pointerEvents: 'none' }}>
                <span style={{ pointerEvents: 'auto' }}>
                  <DenButton label="Back" variant="quiet" shape="pill" size="md" iconOnly boxSize={44} iconPaths={BACK_ICON} onClick={onBack} />
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ pointerEvents: 'auto' }}>
                    <ChargeHud shotsRemaining={wave?.shotsRemaining ?? 2} weaponPhase={wave?.weaponPhase ?? 'readyFirstShot'} reducedMotion={reducedMotion} />
                  </span>
                  <div
                    role="status"
                    aria-label="Score"
                    style={{ display: 'flex', alignItems: 'center', gap: 6, height: 40, padding: '0 14px', borderRadius: 9999, background: 'rgba(255,255,255,0.9)', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 16, color: '#2A2E37' }}
                  >
                    {session.solvedItems.length} / {brain.sessionLength}
                  </div>
                  <div role="img" style={{ fontSize: 22 }} aria-label={`${String(session.lives)} lives left`}>
                    {'❤️'.repeat(Math.max(session.lives, 0))}
                  </div>
                  <span style={{ pointerEvents: 'auto' }}>
                    <GameVolumeControl volume={session.audioVolume} onChange={session.setAudioVolume} />
                  </span>
                </div>
              </div>

              <div
                aria-label="Question"
                role="heading"
                aria-level={2}
                style={{
                  position: 'absolute',
                  left: '50%',
                  transform: wavePhase === 'intro' ? 'translate(-50%, -50%) scale(1.4)' : 'translate(-50%, 0) scale(1)',
                  top: wavePhase === 'intro' ? '50%' : 64,
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
                {question.text}
              </div>

              {/* The answers as real buttons: the same targets for keyboard and screen-reader players, independent of the canvas. */}
              <div style={{ position: 'absolute', bottom: 12, left: 16, right: 16, zIndex: 200, display: 'flex', gap: 8, flexWrap: 'wrap', pointerEvents: inputEnabled ? 'auto' : 'none' }}>
                {(wave?.carriers ?? []).map((carrier) =>
                  carrier.status === 'active' ? (
                    <button
                      key={carrier.id}
                      type="button"
                      onClick={() => {
                        session.hit(carrier.id, 'body')
                      }}
                      aria-label={`Zap the zombie carrying ${carrier.label}`}
                      style={{ height: 36, padding: '0 12px', borderRadius: 9999, border: '1px solid rgba(255,255,255,0.5)', background: 'rgba(0,0,0,0.35)', color: '#FFFFFF', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
                    >
                      {carrier.label}
                    </button>
                  ) : null,
                )}
              </div>

              {/* The correct/wrong vignette: colour only at the edge, so it never hides the question, the labels, or the defeat. Remounted (key) per event so it replays. Not for playerAttacked, which gets the stronger overlay below. */}
              {feedback !== null && feedback.kind !== 'playerAttacked' && (
                <div
                  key={feedback.id}
                  aria-hidden="true"
                  data-feedback-kind={feedback.kind}
                  data-feedback-id={feedback.id}
                  className="answer-feedback-vignette"
                  style={{
                    position: 'absolute',
                    inset: 0,
                    zIndex: 205,
                    pointerEvents: 'none',
                    background: feedback.kind === 'correctHit' ? 'radial-gradient(ellipse at center, transparent 58%, rgba(34,197,94,0.6) 100%)' : 'radial-gradient(ellipse at center, transparent 55%, rgba(205,42,32,0.5) 100%)',
                    animation: `vignettePulse ${String(ANSWER_FEEDBACK_MS)}ms ease-out`,
                  }}
                />
              )}

              {session.aimNdc !== null && (
                <div
                  style={{
                    position: 'absolute',
                    left: `${String(((session.aimNdc.x + 1) / 2) * 100)}%`,
                    top: `${String(((1 - session.aimNdc.y) / 2) * 100)}%`,
                    transform: 'translate(-50%, -50%)',
                    pointerEvents: 'none',
                    zIndex: 210,
                    width: 36,
                    height: 36,
                    borderRadius: 9999,
                    border: '2.5px solid #FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {/* The exact pixel the shot is cast through. */}
                  <div style={{ width: 3, height: 3, borderRadius: 9999, background: '#FFFFFF' }} />
                </div>
              )}

              {(phase === 'impact' || phase === 'life_lost_frozen') && (
                <div
                  aria-hidden="true"
                  style={{ position: 'absolute', inset: 0, zIndex: 220, pointerEvents: 'none', background: 'radial-gradient(ellipse at center, transparent 45%, rgba(205,42,32,0.55) 100%)', transition: `opacity ${reducedMotion ? '150' : '400'}ms ease` }}
                />
              )}

              {phase === 'life_lost_frozen' && (
                <div
                  ref={(panel) => {
                    panel?.focus()
                  }}
                  tabIndex={-1}
                  role="dialog"
                  aria-label="Round result"
                  style={{ position: 'absolute', inset: 0, zIndex: 230, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(20,10,10,0.45)' }}
                >
                  <div style={{ background: '#FFF6EA', borderRadius: 28, padding: '32px 36px', maxWidth: 420, textAlign: 'center', boxShadow: '0 22px 44px -16px rgba(0,13,51,0.4)' }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 26, color: '#2A2E37', marginBottom: 10 }}>{wave?.resolutionReason === 'player_contact' ? 'A zombie got through!' : 'Too many wrong targets!'}</div>
                    <p style={{ color: '#8896AA', fontSize: 15, marginBottom: 6 }}>
                      Lives left: {session.lives} · Score: {session.solvedItems.length}/{brain.sessionLength}
                    </p>
                    <p style={{ color: '#8896AA', fontSize: 15, marginBottom: 20 }}>Take a breath—you&apos;ve got another chance.</p>
                    <DenButton label="Next Question" variant="blue" shape="pill" size="lg" lipColor="#0037DB" onClick={session.nextQuestion} />
                  </div>
                </div>
              )}
            </div>
          )}

          {phase === 'transitioning_to_next_wave' && <p style={{ color: 'var(--fg-tertiary)', textAlign: 'center' }}>Loading the next question…</p>}

          {phase === 'complete' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {!session.ratingHandled && <RatingPrompt onRate={session.rate} onDismiss={session.dismissRating} />}
              <SessionComplete
                headline={brain.copy.sessionCompleteHeadline}
                subtitle={brain.copy.sessionCompleteSubtitle}
                badgeSrc={`/images/badges/${brain.gameId}.png`}
                badgeTitle={brain.copy.badgeTitle}
                words={session.solvedItems}
                itemsLabel={brain.copy.itemsLabel}
                summarySlot={<ArenaPerformanceSummary results={session.questionResults} />}
                onPlayAgain={session.playAgain}
                onAllDone={onBack}
              />
            </div>
          )}

          {phase === 'game_over' && (
            <div style={{ position: 'relative', background: '#FFF6EA', border: '1px solid #F1ECE0', borderRadius: 32, padding: '48px 40px 44px', textAlign: 'center', boxShadow: '0 22px 44px -16px rgba(0,13,51,0.14)' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.09em', textTransform: 'uppercase', fontWeight: 700, color: '#98A2B3', marginBottom: 10 }}>Speed round</div>
              <h1 style={{ margin: '0 0 10px', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 36, color: '#2A2E37' }}>{brain.copy.gameOverHeadline}</h1>
              <p style={{ color: '#8896AA', fontSize: 17, marginBottom: 8 }}>
                You solved {session.solvedItems.length} of {brain.sessionLength} before that happened. Give it another go?
              </p>
              <ArenaPerformanceSummary results={session.questionResults} />
              {session.solvedItems.length > 0 && (
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', margin: '18px 0' }}>
                  {session.solvedItems.map((fact, i) => (
                    <span key={`${fact}-${String(i)}`} style={{ display: 'inline-flex', alignItems: 'center', height: 38, padding: '0 14px', borderRadius: 9999, background: '#FFFFFF', border: '1px solid #EEE4D2', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 15, color: '#2A2E37' }}>
                      {fact}
                    </span>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginTop: 20 }}>
                <DenButton label="Back" variant="quiet" shape="pill" size="lg" onClick={onBack} />
                <DenButton label="Try again" variant="blue" shape="pill" size="lg" lipColor="#0037DB" onClick={session.playAgain} />
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }
  return ZombieArena
}
