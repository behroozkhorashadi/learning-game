import type { ReactElement } from 'react'
import { DenButton } from '@app/den/den_button.pure.ui.tsx'
import { formatTime } from './horde_scoring.pure.lib.ts'
import type { ArmedMode, FeedbackKind } from './use_horde_round.pure.hook.ts'

/**
 * Everything drawn over the 3D view during a round: Back, the clock (counting
 * down, then in overtime counting up against the personal best), lives,
 * grenades, push-backs, mute, the question (and "I don't know"), the answers as real buttons (the same
 * targets for keyboard and screen-reader players, independent of the
 * canvas), the crosshair, and the hit/hurt flashes. Props only.
 */

export interface HudAnswer {
  readonly zombieId: string
  readonly label: string
}

/** Past the clock: how long the round has lasted, and the record to beat (0 for none yet). */
export interface HudOvertime {
  readonly lastedMs: number
  readonly bestMs: number
  readonly clockMs: number
}

/** How long the "Overtime!" banner shows once the clock is beaten. */
export const OVERTIME_BANNER_MS = 3000

export interface HordeHudProps {
  /** The question, or the whole fact once its answer is revealed. */
  readonly question: string | null
  /** The answer is showing ("I don't know" was pressed). */
  readonly revealed: boolean
  /** Shows the answer; null hides the button (between questions, once revealed, during the intro). */
  readonly onDontKnow: (() => void) | null
  /** The question fills the screen before the horde moves. */
  readonly intro: boolean
  readonly secondsLeft: number
  /** Null until the clock is beaten. */
  readonly overtime: HudOvertime | null
  /** Stops in overtime and banks the round. */
  readonly onEndOvertime: () => void
  readonly lives: number
  readonly grenades: number
  /** Push-backs left this round. */
  readonly shoves: number
  /** A push-back was just earned: show it for a moment. */
  readonly shoveEarned: boolean
  /** Special rounds left, or null with standard rounds loaded (they never run out). */
  readonly ammo: number | null
  /** The last special round was just fired: show it for a moment. */
  readonly outOfRounds: boolean
  /** What the next click does. */
  readonly armed: ArmedMode
  readonly muted: boolean
  readonly answers: readonly HudAnswer[]
  readonly feedback: { readonly kind: FeedbackKind; readonly id: number } | null
  readonly aimNdc: { readonly x: number; readonly y: number } | null
  readonly reducedMotion: boolean
  readonly onBack: () => void
  readonly onToggleGrenade: () => void
  /** Pushes the closest zombie back (also the space bar). */
  readonly onPushBack: () => void
  readonly onToggleMute: () => void
  /** Zaps a zombie's body from the answer buttons. */
  readonly onZap: (zombieId: string) => void
  /** Moments flagged so far this round. */
  readonly flags: number
  /** Flags this moment in the round's recording, to look at later. */
  readonly onFlag: () => void
}

const BACK_ICON = ['M10.25 6.75L4.75 12L10.25 17.25M19.25 12H5']
const MUTED_ICON = ['M4.75 9.75H8L13.25 5V19L8 14.25H4.75V9.75Z', 'M17 8.5L21 15.5M21 8.5L17 15.5']
const SOUND_ICON = ['M4.75 9.75H8L13.25 5V19L8 14.25H4.75V9.75Z', 'M17 9C17.8 9.7 18.25 10.8 18.25 12C18.25 13.2 17.8 14.3 17 15']

const FLASH: Record<FeedbackKind, string> = {
  correct: 'radial-gradient(ellipse at center, transparent 58%, rgba(34,197,94,0.6) 100%)',
  boom: 'radial-gradient(ellipse at center, transparent 50%, rgba(255,159,28,0.6) 100%)',
  wrong: 'radial-gradient(ellipse at center, transparent 58%, rgba(245,158,11,0.55) 100%)',
  dud: 'radial-gradient(ellipse at center, transparent 58%, rgba(156,163,175,0.55) 100%)',
  hurt: 'radial-gradient(ellipse at center, transparent 40%, rgba(205,42,32,0.65) 100%)',
  shove: 'radial-gradient(ellipse at center, transparent 58%, rgba(61,139,255,0.55) 100%)',
}

const PILL = { display: 'flex', alignItems: 'center', gap: 6, height: 40, padding: '0 14px', borderRadius: 9999, background: 'rgba(255,255,255,0.9)', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 16, color: '#2A2E37' } as const

/** A keyboard key drawn as a little keycap, so players see the shortcut without hovering. */
const KEYCAP = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 18, height: 18, padding: '0 4px', borderRadius: 4, border: '1px solid #98A2B3', borderBottomWidth: 2, background: '#FFFFFF', fontFamily: 'var(--font-body, sans-serif)', fontWeight: 700, fontSize: 11, color: '#475467' } as const

const BANNER = { padding: '8px 16px', borderRadius: 9999, color: '#FFFFFF', fontWeight: 800, whiteSpace: 'nowrap' } as const

const ARMED_COLOR: Record<ArmedMode, string> = { shot: '#FFFFFF', grenade: '#FF9F1C' }

function clockLabel(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const rest = `${String(seconds % 60)} second${seconds % 60 === 1 ? '' : 's'}`
  return minutes === 0 ? rest : `${String(minutes)} minute${minutes === 1 ? '' : 's'} ${rest}`
}

export function HordeHud({ question, revealed, onDontKnow, intro, secondsLeft, overtime, onEndOvertime, lives, grenades, shoves, shoveEarned, ammo, outOfRounds, armed, muted, answers, feedback, aimNdc, reducedMotion, onBack, onToggleGrenade, onPushBack, onToggleMute, onZap, flags, onFlag }: HordeHudProps): ReactElement {
  const grenadeArmed = armed === 'grenade'
  const ring = ARMED_COLOR[armed]
  const newRecord = overtime !== null && overtime.bestMs > 0 && overtime.lastedMs > overtime.bestMs
  const banner = overtime !== null && overtime.lastedMs - overtime.clockMs < OVERTIME_BANNER_MS
  return (
    <>
      <div style={{ position: 'absolute', top: 16, left: 16, right: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', zIndex: 200, pointerEvents: 'none' }}>
        <span style={{ pointerEvents: 'auto' }}>
          <DenButton label="Back" variant="quiet" shape="pill" size="md" iconOnly boxSize={44} iconPaths={BACK_ICON} onClick={onBack} />
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {overtime === null ? (
            <div role="timer" aria-label={`${String(secondsLeft)} seconds left`} style={{ ...PILL, color: secondsLeft <= 10 ? '#CD2A20' : '#2A2E37' }}>
              ⏱ {secondsLeft}s
            </div>
          ) : (
            <>
              <div role="timer" aria-label={`Overtime: ${clockLabel(overtime.lastedMs)} survived`} style={{ ...PILL, background: '#2A2E37', color: '#FFB020' }}>
                🔥 {formatTime(overtime.lastedMs)}
              </div>
              {overtime.bestMs > 0 && (
                <div role="status" aria-label={newRecord ? 'New personal best!' : `Your best: ${clockLabel(overtime.bestMs)}`} style={{ ...PILL, color: newRecord ? '#3F7A22' : '#5B6576' }}>
                  🏅 {newRecord ? 'New record!' : `Best ${formatTime(overtime.bestMs)}`}
                </div>
              )}
              <span style={{ pointerEvents: 'auto' }}>
                <DenButton label="Stop & bank points" variant="blue" shape="pill" size="md" lipColor="#0037DB" onClick={onEndOvertime} />
              </span>
            </>
          )}
          {ammo !== null && (
            <div role="status" aria-label={ammo > 0 ? `${String(ammo)} special rounds left` : 'Special rounds used up: back to standard rounds'} style={{ ...PILL, color: ammo > 0 ? '#7F5305' : '#98A2B3' }}>
              🔶 {ammo}
            </div>
          )}
          <div role="img" aria-label={`${String(lives)} lives left`} style={{ fontSize: 22 }}>
            {'❤️'.repeat(Math.max(lives, 0))}
          </div>
          <span style={{ pointerEvents: 'auto' }}>
            <button
              type="button"
              aria-pressed={grenadeArmed}
              aria-label={`Grenade (${String(grenades)} left)${grenadeArmed ? ': armed, click the floor to throw' : ''}`}
              aria-keyshortcuts="G"
              title="Grenade (G)"
              disabled={grenades <= 0}
              onClick={onToggleGrenade}
              style={{ ...PILL, border: grenadeArmed ? '3px solid #FF9F1C' : '3px solid transparent', cursor: grenades > 0 ? 'pointer' : 'not-allowed', opacity: grenades > 0 ? 1 : 0.5 }}
            >
              💣 {grenades}
              <kbd aria-hidden="true" style={KEYCAP}>G</kbd>
            </button>
          </span>
          <span style={{ pointerEvents: 'auto' }}>
            <button
              type="button"
              aria-label={`Push back the closest zombie (${String(shoves)} left)`}
              title="Push back the closest zombie (space)"
              disabled={shoves <= 0}
              onClick={onPushBack}
              style={{ ...PILL, border: 0, cursor: shoves > 0 ? 'pointer' : 'not-allowed', opacity: shoves > 0 ? 1 : 0.5 }}
            >
              ✋ {shoves}
            </button>
          </span>
          <span style={{ pointerEvents: 'auto' }}>
            <button type="button" aria-label={`Flag this moment (${String(flags)} flagged)`} title="Something feel off? Flag it (M)" onClick={onFlag} style={{ ...PILL, border: 0, cursor: 'pointer' }}>
              🚩 {flags}
            </button>
          </span>
          <span style={{ pointerEvents: 'auto' }}>
            <DenButton label={muted ? 'Unmute' : 'Mute'} variant="quiet" shape="pill" size="md" iconOnly boxSize={44} onClick={onToggleMute} iconPaths={muted ? MUTED_ICON : SOUND_ICON} />
          </span>
        </div>
      </div>

      {question !== null && (
        <div
          aria-label="Question"
          role="heading"
          aria-level={2}
          style={{
            position: 'absolute',
            left: '50%',
            top: intro ? '50%' : 72,
            transform: intro ? 'translate(-50%, -50%) scale(1.4)' : 'translate(-50%, 0) scale(1)',
            transition: reducedMotion ? 'none' : 'top 500ms cubic-bezier(0.2,0,0,1), transform 500ms cubic-bezier(0.2,0,0,1)',
            zIndex: 150,
            padding: '14px 24px',
            borderRadius: 20,
            background: revealed ? '#EAF6E2' : '#FFFFFF',
            border: revealed ? '3px solid #3F7A22' : '3px solid transparent',
            boxShadow: '0 10px 24px -12px rgba(0,13,51,0.35)',
            fontFamily: 'var(--font-display)',
            fontWeight: 800,
            fontSize: 34,
            color: revealed ? '#3F7A22' : '#2A2E37',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
          }}
        >
          {question}
        </div>
      )}

      {overtime !== null && banner && (
        <div aria-hidden="true" style={{ position: 'absolute', top: '42%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 160, padding: '16px 28px', borderRadius: 24, background: 'rgba(42,46,55,0.92)', color: '#FFFFFF', textAlign: 'center', pointerEvents: 'none', whiteSpace: 'nowrap' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 36, color: '#FFB020' }}>🔥 Overtime!</div>
          <div style={{ fontSize: 17, fontWeight: 600, marginTop: 4 }}>{overtime.bestMs > 0 ? `The zombies speed up. Beat your best: ${formatTime(overtime.bestMs)}` : 'The zombies speed up. How long can you last?'}</div>
        </div>
      )}

      <div style={{ position: 'absolute', top: 140, left: '50%', transform: 'translateX(-50%)', zIndex: 150, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, pointerEvents: 'none' }}>
        {onDontKnow !== null && (
          <span style={{ pointerEvents: 'auto' }}>
            <button type="button" aria-label="I don't know" aria-keyshortcuts="?" title="Show me the answer (?)" onClick={onDontKnow} style={{ ...PILL, height: 36, border: 0, cursor: 'pointer', fontSize: 15 }}>
              🤔 I don&apos;t know
              <kbd aria-hidden="true" style={KEYCAP}>?</kbd>
            </button>
          </span>
        )}
        {revealed && (
          // Screen readers hear the answer from the round's live message; the banner is for eyes.
          <div aria-hidden="true" style={{ ...BANNER, background: '#3F7A22' }}>
            Now you know! Zap the zombie with the answer
          </div>
        )}
        {shoveEarned && (
          <div aria-hidden="true" style={{ ...BANNER, background: '#3D8BFF' }}>
            ✋ +1 push-back for 3 right answers!
          </div>
        )}
        {armed !== 'shot' && (
          <div role="status" style={{ ...BANNER, background: ring }}>
            Grenade ready: click near the right zombie (G to cancel)
          </div>
        )}
        {outOfRounds && (
          // Screen readers hear this from the round's live message; the banner is for eyes.
          <div aria-hidden="true" style={{ ...BANNER, background: '#7F5305' }}>
            🔶 Out of special rounds: back to standard
          </div>
        )}
      </div>

      <div style={{ position: 'absolute', bottom: 12, left: 16, right: 16, zIndex: 200, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {answers.map((answer) => (
          <button
            key={answer.zombieId}
            type="button"
            onClick={() => {
              onZap(answer.zombieId)
            }}
            aria-label={`Zap the zombie carrying ${answer.label}`}
            style={{ height: 36, padding: '0 12px', borderRadius: 9999, border: '1px solid rgba(255,255,255,0.5)', background: 'rgba(0,0,0,0.35)', color: '#FFFFFF', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
          >
            {answer.label}
          </button>
        ))}
      </div>

      {feedback !== null && (
        <div
          key={feedback.id}
          aria-hidden="true"
          data-feedback-kind={feedback.kind}
          className="answer-feedback-vignette"
          style={{ position: 'absolute', inset: 0, zIndex: 205, pointerEvents: 'none', background: FLASH[feedback.kind], animation: reducedMotion ? 'none' : 'vignettePulse 420ms ease-out' }}
        />
      )}

      {aimNdc !== null && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: `${String(((aimNdc.x + 1) / 2) * 100)}%`,
            top: `${String(((1 - aimNdc.y) / 2) * 100)}%`,
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
            zIndex: 210,
            width: armed === 'shot' ? 36 : 52,
            height: armed === 'shot' ? 36 : 52,
            borderRadius: 9999,
            border: `2.5px solid ${ring}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div style={{ width: 3, height: 3, borderRadius: 9999, background: ring }} />
        </div>
      )}
    </>
  )
}
