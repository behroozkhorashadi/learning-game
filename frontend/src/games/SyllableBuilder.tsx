import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AttemptCreate, AttemptRead, Item, VerificationCreate } from '../types/generated'
import { TileAssembly, type TileAssemblyItem, type TileResult } from '../components/TileAssembly'
import { ImagePlaceholderIcon, SpeakerIcon } from '../components/icons'
import { ProgressBar } from '../components/ProgressBar'
import { RatingPrompt } from '../components/RatingPrompt'
import { HandoffPencil } from '../components/HandoffPencil'
import { ParentVerify } from '../components/ParentVerify'
import { SessionComplete } from '../components/SessionComplete'
import { speakWord } from '../lib/speech'

/**
 * Syllable Builder item screen — ported from the Claude Design handoff
 * bundle (`Syllable Builder.dc.html`). Renders whatever Item and level the
 * server hands back and posts a full telemetry-core Attempt; it does not
 * decide difficulty or generate items itself (PRD §6).
 */

const GAME_ID = 'syllable_builder'
// PRD §"Session flow": "a set number of items", left as an implementation
// detail — matches the Claude Design handoff's "make five words" session.
const SESSION_LENGTH = 5

function WordPicture({ word }: { word: string }) {
  const [broken, setBroken] = useState(false)
  const boxStyle = {
    flex: 'none',
    width: 132,
    height: 132,
    borderRadius: 22,
    background: 'var(--surface-subtle)',
    border: '2px dashed var(--border-tray)',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    color: 'var(--fg-disabled)',
    boxSizing: 'border-box' as const,
    padding: 8,
    overflow: 'hidden',
  }

  if (broken) {
    return (
      <div style={boxStyle}>
        <ImagePlaceholderIcon size={32} />
        <span style={{ fontSize: 12, fontWeight: 600, textAlign: 'center', lineHeight: 1.3 }}>No picture yet</span>
      </div>
    )
  }

  return (
    <div style={boxStyle}>
      <img
        key={word}
        src={`/images/words/${word}.png`}
        alt={word}
        onError={() => setBroken(true)}
        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
      />
    </div>
  )
}

function toTileAssemblyItem(item: Item): TileAssemblyItem {
  const targetWord = item.payload['target_word'] as string
  const correctSyllables = item.payload['correct_syllables'] as string[]
  const tiles = item.payload['tiles'] as string[]
  return {
    kind: 'word',
    instruction: 'Put the sounds in order to build the word',
    spoken: targetWord,
    slots: correctSyllables.length,
    answer: correctSyllables,
    // `id` must be unique per tile even when the syllable text repeats within
    // a word (e.g. "tomato" → to-ma-to) — TileAssembly tracks tiles by `id` in
    // Sets/objects, so two tiles sharing an id become indistinguishable and
    // placing one makes both vanish from the tray.
    tiles: tiles.map((syllable, i) => ({ id: `${syllable}-${i}`, label: syllable })),
  }
}

type Phase = 'playing' | 'handoff' | 'verify' | 'complete'

interface Props {
  profileId: number
  profileName?: string
  onBack: () => void
}

export function SyllableBuilder({ profileId, profileName, onBack }: Props) {
  const [item, setItem] = useState<Item | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [posting, setPosting] = useState(false)
  const [lastResult, setLastResult] = useState<AttemptRead | null>(null)
  const [startedAt, setStartedAt] = useState<number>(0)
  // Regenerated whenever a session restarts (mount, or "Play again" after
  // wrap-up) so the server can avoid repeating a word already shown within
  // that session — see `repeat_key` in the syllable_builder game module.
  const [sessionId, setSessionId] = useState<string>(() => crypto.randomUUID())
  const [completedWords, setCompletedWords] = useState<string[]>([])
  const [phase, setPhase] = useState<Phase>('playing')
  // The word and attempt id from the session's last item — carried through
  // the paper handoff and parent-verify steps (PRD §4, §6: once per session,
  // after the last word).
  const [finalWord, setFinalWord] = useState<string | null>(null)
  const [finalAttemptId, setFinalAttemptId] = useState<number | null>(null)
  const [ratingHandled, setRatingHandled] = useState(false)
  // Item ids already counted toward `completedWords`, guarding against a
  // double-submit of the same item rather than deduping by word text — the
  // word bank is small enough that the same word can legitimately reappear
  // later in a session (see `generate_item`'s exhausted-pool fallback), and
  // that repeat must still count toward the session.
  const countedItemIds = useRef<Set<string>>(new Set())
  // React StrictMode intentionally double-invokes effects in dev, which would
  // otherwise fire `fetchItem` twice for the same session and burn an extra
  // slot from the (small) no-repeat word pool before the player even answers
  // one item. Guard so each session id only ever triggers one real fetch.
  const fetchedForSession = useRef<string | null>(null)

  // `item` changes reference every time SyllableBuilder re-renders while
  // posting an attempt (setPosting/setLastResult). TileAssembly resets its
  // feedback state whenever its `item` prop reference changes, so this must
  // stay stable across those re-renders or the "correct" banner gets wiped
  // the instant Check is clicked, before it's ever visible.
  const tileAssemblyItem = useMemo(() => (item ? toTileAssemblyItem(item) : null), [item])

  const fetchItem = useCallback(async () => {
    setError(null)
    setLastResult(null)
    try {
      const res = await fetch(
        `/api/items/next?profile_id=${profileId}&game_id=${GAME_ID}&session_id=${sessionId}`,
      )
      if (!res.ok) throw new Error(`GET /api/items/next -> ${res.status}`)
      const next: Item = await res.json()
      setItem(next)
      setStartedAt(performance.now())
    } catch (err) {
      setError(String(err))
    }
  }, [profileId, sessionId])

  useEffect(() => {
    if (fetchedForSession.current === sessionId) return
    fetchedForSession.current = sessionId
    fetchItem()
  }, [sessionId, fetchItem])

  function playAgainSession() {
    setCompletedWords([])
    setPhase('playing')
    setFinalWord(null)
    setFinalAttemptId(null)
    setRatingHandled(false)
    countedItemIds.current = new Set()
    setSessionId(crypto.randomUUID())
  }

  function submitRating(value: number) {
    setRatingHandled(true)
    fetch('/api/ratings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile_id: profileId, game_id: GAME_ID, scale: 'stars_1_5', value }),
    }).catch((err) => setError(String(err)))
  }

  function submitVerification(correct: boolean) {
    if (finalAttemptId == null) return
    setPhase('complete')
    const payload: VerificationCreate = { attempt_id: finalAttemptId, correct }
    fetch('/api/verifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch((err) => setError(String(err)))
  }

  async function handleResult(result: TileResult) {
    if (!item) return
    let justCompletedSession = false
    const word = item.payload['target_word'] as string
    if (result.correct && !countedItemIds.current.has(item.item_id)) {
      countedItemIds.current.add(item.item_id)
      setCompletedWords((prev) => {
        const next = [...prev, word]
        justCompletedSession = next.length >= SESSION_LENGTH
        return next
      })
    }
    setPosting(true)
    setError(null)
    const timeMs = Math.round(performance.now() - startedAt)
    const payload: AttemptCreate = {
      item_id: item.item_id,
      profile_id: profileId,
      game_id: item.game_id,
      session_id: sessionId,
      telemetry: { correct: result.correct, hints_used: result.hintsUsed, time_ms: timeMs },
      details: { assembled: result.placement },
    }
    try {
      const res = await fetch('/api/attempts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error(`POST /api/attempts -> ${res.status}`)
      const attemptResult: AttemptRead = await res.json()
      setLastResult(attemptResult)
      if (justCompletedSession) {
        setFinalWord(word)
        setFinalAttemptId(attemptResult.id)
        // Small delay so the "You built it!" feedback banner is visible
        // before the handoff screen replaces the whole card (PRD: "a
        // satisfying wrap-up").
        setTimeout(() => setPhase('handoff'), 900)
      }
    } catch (err) {
      setError(String(err))
    } finally {
      setPosting(false)
    }
  }

  return (
    <div style={{ minHeight: '100%', boxSizing: 'border-box', background: 'var(--surface-app)', display: 'flex', justifyContent: 'center', padding: '32px 24px 56px' }}>
      <div style={{ width: '100%', maxWidth: 760, display: 'flex', flexDirection: 'column' }}>
        {phase === 'playing' && (
          <div style={{ marginBottom: 26 }}>
            <ProgressBar total={SESSION_LENGTH} currentIndex={completedWords.length} onBack={onBack} />
          </div>
        )}

        {error && (
          <pre style={{ color: '#CD2A20', background: '#FDF2F2', padding: 12, borderRadius: 12 }}>Error: {error}</pre>
        )}

        {phase === 'handoff' && finalWord && (
          <HandoffPencil word={finalWord} onWroteIt={() => setPhase('verify')} />
        )}

        {phase === 'verify' && finalWord && (
          <ParentVerify word={finalWord} kidName={profileName} onResult={submitVerification} />
        )}

        {phase === 'complete' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {!ratingHandled && <RatingPrompt onRate={submitRating} onDismiss={() => setRatingHandled(true)} />}
            <SessionComplete
              headline="You built them all!"
              subtitle="Five words, all put together. Nice work sounding them out."
              badgeSrc={`/images/badges/${GAME_ID}.png`}
              badgeTitle="Word Wizard badge"
              words={completedWords}
              onPlayAgain={playAgainSession}
              onAllDone={onBack}
            />
          </div>
        )}

        {phase === 'playing' && item && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap', background: 'var(--surface-default)', border: '1px solid var(--border-subtle)', borderRadius: 24, padding: '24px 28px', boxShadow: 'var(--elevation-300)' }}>
            <WordPicture key={item.payload['target_word'] as string} word={item.payload['target_word'] as string} />
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.09em', textTransform: 'uppercase', fontWeight: 700, color: 'var(--fg-tertiary)', marginBottom: 8 }}>
                Listen, then build the word
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => speakWord(item.payload['target_word'] as string)}
                  aria-label="Hear the word"
                  title="Hear the word"
                  style={{ width: 56, height: 56, borderRadius: 9999, border: '2px solid #C2D1FF', background: '#F0F4FF', color: '#144FFF', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flex: 'none' }}
                >
                  <SpeakerIcon size={26} />
                </button>
                <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 20, color: 'var(--fg-primary)' }}>Tap to hear the word</span>
              </div>
              <div style={{ marginTop: 10, fontSize: 16, lineHeight: '22px', color: 'var(--fg-tertiary)' }}>
                Tap a sound to place it, or drag it into a box.
              </div>
            </div>
          </div>
        )}

        {phase === 'playing' && item && tileAssemblyItem && (
          <div style={{ marginTop: 28 }}>
            <TileAssembly
              key={item.item_id}
              item={tileAssemblyItem}
              onResult={handleResult}
              onPlayAgain={fetchItem}
              embedded
              showAudio={false}
            />
          </div>
        )}

        {phase === 'playing' && posting && <p style={{ color: 'var(--fg-tertiary)' }}>Saving...</p>}
        {phase === 'playing' && lastResult && !posting && (
          <p style={{ color: 'var(--fg-tertiary)', fontSize: 14 }}>
            Recorded (event {lastResult.event_id.slice(0, 8)}) — level stays server-owned for the next item.
          </p>
        )}
      </div>
    </div>
  )
}
