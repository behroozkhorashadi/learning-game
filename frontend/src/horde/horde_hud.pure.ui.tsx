import type { ReactElement } from 'react'
import { DenButton } from '@app/den/den_button.pure.ui.tsx'
import type { Armor, GemKind } from './horde_armory.pure.lib.ts'
import { HEAL_STREAK } from './horde_engine.pure.lib.ts'
import { formatTime } from './horde_scoring.pure.lib.ts'
import type { ArmedMode, FeedbackKind } from './use_horde_round.pure.hook.ts'

/**
 * Everything drawn over the 3D view during a round: Back and "I don't know" (top left), the clock (counting
 * down, then in overtime counting up against the personal best), lives
 * (whole and half hearts), armor gem charges, grenades, push-backs, mute, the question, the answers as real buttons (the same
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
  readonly question: string | null
  /** The whole fact once "I don't know" was pressed ("6 × 7 = 42"), shown small in the top right, out of the field's way; null otherwise. */
  readonly revealedAnswer: string | null
  /** Shows the answer; null hides the button (between questions, once revealed, during the intro). */
  readonly onDontKnow: (() => void) | null
  /** The question fills the screen before the horde moves. */
  readonly intro: boolean
  readonly secondsLeft: number
  /** Null until the clock is beaten. */
  readonly overtime: HudOvertime | null
  /** Stops in overtime and banks the round. */
  readonly onEndOvertime: () => void
  /** Whole or half (after a blocked zombie). */
  readonly lives: number
  /** Armor gem charges left; a gem with none left isn't shown. */
  readonly armor: Armor
  /** Right answers in a row, toward the next heal. */
  readonly streak: number
  /** The worn skin's colour: gem flashes glow in it. */
  readonly armorColor: string
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
  // Reflect and block glow in the worn skin's colour (`gemFlash`); these are the fallbacks.
  reflect: 'radial-gradient(ellipse at center, transparent 50%, rgba(92,225,230,0.65) 100%)',
  block: 'radial-gradient(ellipse at center, transparent 45%, rgba(124,92,255,0.6) 100%)',
  heal: 'radial-gradient(ellipse at center, transparent 50%, rgba(91,204,45,0.6) 100%)',
}

/** A gem's flash, in the skin's colour. */
function flashFor(kind: FeedbackKind, armorColor: string): string {
  if (kind === 'reflect') return `radial-gradient(ellipse at center, transparent 50%, color-mix(in srgb, ${armorColor} 70%, transparent) 100%)`
  if (kind === 'block') return `radial-gradient(ellipse at center, transparent 42%, color-mix(in srgb, ${armorColor} 70%, transparent) 100%)`
  return FLASH[kind]
}

const GEM_PILLS: readonly { readonly kind: GemKind; readonly icon: string; readonly color: string; readonly label: (n: number) => string }[] = [
  { kind: 'reflect', icon: '🪞', color: '#1C7FD6', label: (n) => `${String(n)} reflect${n === 1 ? '' : 's'} left: throws bounce back` },
  { kind: 'block', icon: '🛡️', color: '#5B3FD6', label: (n) => `${String(n)} block${n === 1 ? '' : 's'} left: a zombie that gets through only takes half a heart` },
  { kind: 'mega', icon: '💎', color: '#B4247E', label: (n) => `${String(n)} mega charge${n === 1 ? '' : 's'} left: reflects or blocks` },
  { kind: 'heal', icon: '💚', color: '#3F7A22', label: (n) => `${String(n)} heal${n === 1 ? '' : 's'} left: ${String(HEAL_STREAK)} right answers in a row win back half a heart` },
]

/** Lives as a screen reader hears them: "3 lives left", "2 and a half lives left", "Half a life left". */
export function livesLabel(lives: number): string {
  const whole = Math.floor(Math.max(lives, 0))
  const half = lives - whole >= 0.5
  if (whole === 0 && half) return 'Half a life left'
  if (half) return `${String(whole)} and a half lives left`
  return `${String(whole)} ${whole === 1 ? 'life' : 'lives'} left`
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

export function HordeHud({ question, revealedAnswer, onDontKnow, intro, secondsLeft, overtime, onEndOvertime, lives, armor, streak, armorColor, grenades, shoves, shoveEarned, ammo, outOfRounds, armed, muted, answers, feedback, aimNdc, reducedMotion, onBack, onToggleGrenade, onPushBack, onToggleMute, onZap, flags, onFlag }: HordeHudProps): ReactElement {
  const grenadeArmed = armed === 'grenade'
  const ring = ARMED_COLOR[armed]
  const newRecord = overtime !== null && overtime.bestMs > 0 && overtime.lastedMs > overtime.bestMs
  const banner = overtime !== null && overtime.lastedMs - overtime.clockMs < OVERTIME_BANNER_MS
  return (
    <>
      <div style={{ position: 'absolute', top: 16, left: 16, right: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', zIndex: 200, pointerEvents: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, pointerEvents: 'auto' }}>
          <DenButton label="Back" variant="quiet" shape="pill" size="md" iconOnly boxSize={44} iconPaths={BACK_ICON} onClick={onBack} />
          {onDontKnow !== null && (
            <button type="button" aria-label="I don't know" aria-keyshortcuts="?" title="Show me the answer (?)" onClick={onDontKnow} style={{ ...PILL, border: 0, cursor: 'pointer' }}>
              🤔 I don&apos;t know
              <kbd aria-hidden="true" style={KEYCAP}>?</kbd>
            </button>
          )}
          {overtime !== null && (
            <button type="button" aria-label="Stop & bank points" title="Stop here and bank your points" onClick={onEndOvertime} style={{ ...PILL, border: 0, cursor: 'pointer', background: '#3D8BFF', color: '#FFFFFF' }}>
              🏁 Stop &amp; bank
            </button>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {revealedAnswer !== null && (
            <div role="status" aria-label={`The answer: ${revealedAnswer}`} style={{ ...PILL, background: '#3F7A22', color: '#FFFFFF' }}>
              💡 {revealedAnswer}
            </div>
          )}
          {overtime === null ? (
            <div role="timer" aria-label={`${String(secondsLeft)} seconds left`} style={{ ...PILL, color: secondsLeft <= 10 ? '#CD2A20' : '#2A2E37' }}>
              ⏱ {secondsLeft}s
            </div>
          ) : (
            // One pill for the clock and the record to beat, so overtime adds nothing to a full bar.
            <div style={{ ...PILL, background: '#2A2E37', color: '#FFB020' }}>
              <span role="timer" aria-label={`Overtime: ${clockLabel(overtime.lastedMs)} survived`}>
                🔥 {formatTime(overtime.lastedMs)}
              </span>
              {overtime.bestMs > 0 && (
                <span role="status" aria-label={newRecord ? 'New personal best!' : `Your best: ${clockLabel(overtime.bestMs)}`} style={{ fontSize: 14, color: newRecord ? '#8EE06A' : '#C9CED8' }}>
                  🏅 {newRecord ? 'New record!' : `Best ${formatTime(overtime.bestMs)}`}
                </span>
              )}
            </div>
          )}
          {ammo !== null && (
            <div role="status" aria-label={ammo > 0 ? `${String(ammo)} special rounds left` : 'Special rounds used up: back to standard rounds'} style={{ ...PILL, color: ammo > 0 ? '#7F5305' : '#98A2B3' }}>
              🔶 {ammo}
            </div>
          )}
          {GEM_PILLS.map((gem) =>
            armor[gem.kind] > 0 ? (
              <div key={gem.kind} role="status" aria-label={gem.label(armor[gem.kind])} title={gem.label(armor[gem.kind])} style={{ ...PILL, color: gem.color }}>
                {gem.icon} {armor[gem.kind]}
                {gem.kind === 'heal' && (
                  <span role="meter" aria-label="Right answers in a row" aria-valuemin={0} aria-valuemax={HEAL_STREAK} aria-valuenow={Math.min(streak, HEAL_STREAK)} style={{ fontSize: 12, color: '#5B6576' }}>
                    {Math.min(streak, HEAL_STREAK)}/{HEAL_STREAK}
                  </span>
                )}
              </div>
            ) : null,
          )}
          <div role="img" aria-label={livesLabel(lives)} style={{ fontSize: 22 }}>
            {'❤️'.repeat(Math.floor(Math.max(lives, 0)))}
            {lives - Math.floor(Math.max(lives, 0)) >= 0.5 ? '💔' : ''}
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
          {question}
        </div>
      )}

      <div style={{ position: 'absolute', top: 140, left: '50%', transform: 'translateX(-50%)', zIndex: 150, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, pointerEvents: 'none' }}>
        {overtime !== null && banner && (
          // Small, under the question: a big banner here hid the horde just as it sped up.
          <div aria-hidden="true" style={{ ...BANNER, background: '#2A2E37', color: '#FFB020' }}>
            🔥 Overtime! The zombies speed up{overtime.bestMs > 0 ? `. Beat ${formatTime(overtime.bestMs)}` : ''}
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
          style={{ position: 'absolute', inset: 0, zIndex: 205, pointerEvents: 'none', background: flashFor(feedback.kind, armorColor), animation: reducedMotion ? 'none' : 'vignettePulse 420ms ease-out' }}
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
