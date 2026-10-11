import type { ComponentType, ReactElement } from 'react'
import { DenButton } from '@app/den/den_button.pure.ui.tsx'
import type { PracticeDeps } from '@app/practice/practice_state.pure.lib.ts'
import { usePracticeSession } from '@app/practice/use_practice_session.pure.hook.ts'
import { HandoffPencil } from '@app/session/handoff_pencil.pure.ui.tsx'
import { ParentVerify } from '@app/session/parent_verify.pure.ui.tsx'
import { ProgressBar } from '@app/session/progress_bar.pure.ui.tsx'
import { RatingPrompt } from '@app/session/rating_prompt.pure.ui.tsx'
import { SessionComplete } from '@app/session/session_complete.pure.ui.tsx'
import { SessionStart } from '@app/session/session_start.pure.ui.tsx'
import type { Speech } from '@app/speech/speech_state.pure.lib.ts'
import { TileBoard } from '@app/tiles/tile_board.pure.ui.tsx'
import { SYLLABLE_CONFIG, SYLLABLE_GAME_ID, syllableBoard, type SyllablePayload } from './syllable_item.pure.lib.ts'
import { WordPicture } from './word_picture.pure.ui.tsx'

/**
 * Syllable Builder, ported from the Claude Design handoff bundle
 * (`Syllable Builder.dc.html`). Renders whatever item and level the server
 * hands back and posts a full telemetry-core attempt; it doesn't decide
 * difficulty or generate items (PRD §6). Five words, then the paper handoff
 * and a parent check (PRD §4, §6: once per session, after the last word).
 */

const SPEAKER_ICON = [
  'M15.75 10.75C15.75 10.75 16.25 11.234 16.25 12C16.25 12.766 15.75 13.25 15.75 13.25M17.75 7.75C17.75 7.75 19.25 9 19.25 11.999C19.25 14.997 17.75 16.25 17.75 16.25M13.25 4.75L8.5 8.75H5.75C5.48478 8.75 5.23043 8.85536 5.04289 9.04289C4.85536 9.23043 4.75 9.48478 4.75 9.75V14.25C4.75 14.5152 4.85536 14.7696 5.04289 14.9571C5.23043 15.1446 5.48478 15.25 5.75 15.25H8.5L13.25 19.25V4.75Z',
]
const INSTRUCTIONS = "Slide the sounds together to make five words. Take your time — there's no clock."

export interface SyllableBuilderProps {
  readonly profileId: number
  readonly profileName?: string
  readonly onBack: () => void
}

export interface SyllableBuilderDeps {
  readonly practice: PracticeDeps<SyllablePayload>
  readonly speech: Speech
}

export function bindSyllableBuilder({ practice, speech }: SyllableBuilderDeps): ComponentType<SyllableBuilderProps> {
  function SyllableBuilder({ profileId, profileName, onBack }: SyllableBuilderProps): ReactElement {
    const game = usePracticeSession(practice, SYLLABLE_CONFIG, profileId)
    const { session, item } = game
    const word = item?.payload.target_word ?? null

    return (
      <div style={{ minHeight: '100%', boxSizing: 'border-box', background: 'var(--surface-app)', display: 'flex', justifyContent: 'center', padding: '32px 24px 56px' }}>
        <div style={{ width: '100%', maxWidth: 760, display: 'flex', flexDirection: 'column' }}>
          {session.phase === 'playing' && (
            <div style={{ marginBottom: 26 }}>
              <ProgressBar total={SYLLABLE_CONFIG.sessionLength} currentIndex={session.completed.length} onBack={onBack} />
            </div>
          )}

          {game.error !== null && (
            <pre role="alert" style={{ color: '#CD2A20', background: '#FDF2F2', padding: 12, borderRadius: 12 }}>
              Error: {game.error}
            </pre>
          )}

          {session.phase === 'start' && (
            <SessionStart
              eyebrow="Word building"
              headline="Let's build some words"
              subtitle={INSTRUCTIONS}
              onHearInstructions={() => {
                speech.speakText(INSTRUCTIONS)
              }}
              sessionLength={SYLLABLE_CONFIG.sessionLength}
              heroSrc={`/images/badges/${SYLLABLE_GAME_ID}.png`}
              onStart={game.start}
              onBack={onBack}
            />
          )}

          {session.phase === 'handoff' && session.finalLabel !== null && (
            <HandoffPencil
              word={session.finalLabel}
              onHearWord={() => {
                speech.speakWord(session.finalLabel ?? '')
              }}
              onWroteIt={game.wroteIt}
            />
          )}

          {session.phase === 'verify' && session.finalLabel !== null && <ParentVerify word={session.finalLabel} {...(profileName === undefined ? {} : { kidName: profileName })} onResult={game.verify} />}

          {session.phase === 'complete' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {!session.ratingHandled && <RatingPrompt onRate={game.rate} onDismiss={game.dismissRating} />}
              <SessionComplete
                headline="You built them all!"
                subtitle="Five words, all put together. Nice work sounding them out."
                badgeSrc={`/images/badges/${SYLLABLE_GAME_ID}.png`}
                badgeTitle="Word Wizard badge"
                words={session.completed}
                onPlayAgain={game.playAgain}
                onAllDone={onBack}
              />
            </div>
          )}

          {session.phase === 'playing' && word !== null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap', background: 'var(--surface-default)', border: '1px solid var(--border-subtle)', borderRadius: 24, padding: '24px 28px', boxShadow: 'var(--elevation-300)' }}>
              <WordPicture key={word} word={word} />
              <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.09em', textTransform: 'uppercase', fontWeight: 700, color: 'var(--fg-tertiary)', marginBottom: 8 }}>Listen, then build the word</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                  <DenButton
                    label="Hear the word"
                    variant="softBlue"
                    shape="pill"
                    size="md"
                    iconOnly
                    boxSize={56}
                    iconSize={26}
                    iconPaths={SPEAKER_ICON}
                    onClick={() => {
                      speech.speakWord(word)
                    }}
                  />
                  <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 20, color: 'var(--fg-primary)' }}>Tap to hear the word</span>
                </div>
                <div style={{ marginTop: 10, fontSize: 16, lineHeight: '22px', color: 'var(--fg-tertiary)' }}>Tap a sound to place it, or drag it into a box.</div>
              </div>
            </div>
          )}

          {session.phase === 'playing' && item !== null && (
            <div style={{ marginTop: 28 }}>
              {/* Keyed by item: the board's state is one item's, and survives re-renders while the attempt posts. */}
              <TileBoard key={item.itemId} item={syllableBoard(item.payload)} onResult={game.submit} onSpeak={speech.speakWord} onPlayAgain={game.nextItem} embedded showAudio={false} />
            </div>
          )}

          {session.phase === 'playing' && game.posting && <p style={{ color: 'var(--fg-tertiary)' }}>Saving...</p>}
          {session.phase === 'playing' && game.lastAttempt !== null && !game.posting && (
            <p style={{ color: 'var(--fg-tertiary)', fontSize: 14 }}>Recorded (event {game.lastAttempt.event_id.slice(0, 8)}) — level stays server-owned for the next item.</p>
          )}
        </div>
      </div>
    )
  }
  return SyllableBuilder
}
