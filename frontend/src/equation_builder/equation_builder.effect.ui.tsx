import type { ComponentType, ReactElement } from 'react'
import type { PracticeDeps } from '@app/practice/practice_state.pure.lib.ts'
import { usePracticeSession } from '@app/practice/use_practice_session.pure.hook.ts'
import { ProgressBar } from '@app/session/progress_bar.pure.ui.tsx'
import { RatingPrompt } from '@app/session/rating_prompt.pure.ui.tsx'
import { SessionComplete } from '@app/session/session_complete.pure.ui.tsx'
import { SessionStart } from '@app/session/session_start.pure.ui.tsx'
import type { Speech } from '@app/speech/speech_state.pure.lib.ts'
import { useReadAloud } from '@app/speech/use_read_aloud.pure.hook.ts'
import { TileBoard } from '@app/tiles/tile_board.pure.ui.tsx'
import { EquationDisplay } from './equation_display.pure.ui.tsx'
import { EQUATION_CONFIG, EQUATION_GAME_ID, equationBoard, type EquationPayload } from './equation_item.pure.lib.ts'

/**
 * Equation Builder, the first math game (PRD §7.3, §16 step 9), built the way
 * Syllable Builder is: it renders whatever item and level the server hands
 * back and posts a telemetry-core attempt. Fully objective, so there's no
 * paper handoff or parent check: five equations, then the wrap-up.
 */

const INSTRUCTIONS = "Figure out the missing piece and pop it into place. Take your time — there's no clock."

export interface EquationBuilderProps {
  readonly profileId: number
  readonly onBack: () => void
}

export interface EquationBuilderDeps {
  readonly practice: PracticeDeps<EquationPayload>
  readonly speech: Speech
}

export function bindEquationBuilder({ practice, speech }: EquationBuilderDeps): ComponentType<EquationBuilderProps> {
  function EquationBuilder({ profileId, onBack }: EquationBuilderProps): ReactElement {
    const game = usePracticeSession(practice, EQUATION_CONFIG, profileId)
    const { session, item } = game
    const instructions = useReadAloud(speech, INSTRUCTIONS, session.phase === 'start')

    return (
      <div style={{ minHeight: '100%', boxSizing: 'border-box', background: 'var(--surface-app)', display: 'flex', justifyContent: 'center', padding: '32px 24px 56px' }}>
        <div style={{ width: '100%', maxWidth: 760, display: 'flex', flexDirection: 'column' }}>
          {session.phase === 'playing' && (
            <div style={{ marginBottom: 26 }}>
              <ProgressBar total={EQUATION_CONFIG.sessionLength} currentIndex={session.completed.length} onBack={onBack} />
            </div>
          )}

          {game.error !== null && (
            <pre role="alert" style={{ color: '#CD2A20', background: '#FDF2F2', padding: 12, borderRadius: 12 }}>
              Error: {game.error}
            </pre>
          )}

          {session.phase === 'start' && (
            <SessionStart
              eyebrow="Number sense"
              headline="Let's build some equations"
              subtitle={INSTRUCTIONS}
              readingInstructions={instructions.reading}
              onHearInstructions={instructions.toggle}
              sessionLength={EQUATION_CONFIG.sessionLength}
              heroSrc={`/images/badges/${EQUATION_GAME_ID}.png`}
              onStart={game.start}
              onBack={onBack}
            />
          )}

          {session.phase === 'complete' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {!session.ratingHandled && <RatingPrompt onRate={game.rate} onDismiss={game.dismissRating} />}
              <SessionComplete
                headline="You solved them all!"
                subtitle="Five equations, all figured out. Great thinking."
                badgeSrc={`/images/badges/${EQUATION_GAME_ID}.png`}
                badgeTitle="Equation Ace badge"
                words={session.completed}
                itemsLabel="Equations you solved"
                onPlayAgain={game.playAgain}
                onAllDone={onBack}
              />
            </div>
          )}

          {session.phase === 'playing' && item !== null && (
            <>
              <div style={{ display: 'flex', justifyContent: 'center', background: 'var(--surface-default)', border: '1px solid var(--border-subtle)', borderRadius: 24, padding: '32px 28px', boxShadow: 'var(--elevation-300)' }}>
                <EquationDisplay payload={item.payload} />
              </div>
              <div style={{ marginTop: 28 }}>
                {/* Keyed by item: the board's state is one item's. */}
                <TileBoard key={item.itemId} item={equationBoard(item.payload)} onResult={game.submit} onSpeak={speech.speakWord} onPlayAgain={game.nextItem} embedded showAudio={false} />
              </div>
            </>
          )}

          {session.phase === 'playing' && game.posting && <p style={{ color: 'var(--fg-tertiary)' }}>Saving...</p>}
          {session.phase === 'playing' && game.lastAttempt !== null && !game.posting && (
            <p style={{ color: 'var(--fg-tertiary)', fontSize: 14 }}>Recorded (event {game.lastAttempt.event_id.slice(0, 8)}) — level stays server-owned for the next item.</p>
          )}
        </div>
      </div>
    )
  }
  return EquationBuilder
}
