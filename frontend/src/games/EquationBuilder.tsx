import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AttemptCreate, AttemptRead, Item } from '../types/generated'
import { TileAssembly, type TileAssemblyItem, type TileResult } from '../components/TileAssembly'
import { ProgressBar } from '../components/ProgressBar'
import { RatingPrompt } from '../components/RatingPrompt'
import { SessionComplete } from '../components/SessionComplete'
import { SessionStart } from '../components/SessionStart'

/**
 * Equation Builder item screen — the first math game (PRD §7.3, §16 step 9),
 * built the same way Syllable Builder was: it renders whatever Item and
 * level the server hands back and posts a full telemetry-core Attempt; it
 * does not decide difficulty or generate items itself (PRD §6).
 *
 * Unlike Syllable Builder, this is a fully objective game with no
 * handwriting step, so there's no paper-handoff/parent-verify phase — a
 * correct tile placement is the whole answer (PRD §6: objective games score
 * client-side).
 */

const GAME_ID = 'equation_builder'
const SESSION_LENGTH = 5

type EquationPayload = {
  left: number
  operator: string
  right: number
  answer: number
  missing: 'left' | 'operator' | 'right' | 'answer'
}

function Blank() {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 64,
        height: 64,
        borderRadius: 16,
        border: '2px dashed var(--border-tray)',
        background: 'var(--surface-subtle)',
        color: 'var(--fg-disabled)',
        fontSize: 30,
      }}
    >
      ?
    </span>
  )
}

function EquationDisplay({ payload }: { payload: EquationPayload }) {
  const { left, operator, right, answer, missing } = payload
  const tokenStyle = { fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 40, color: 'var(--fg-primary)' }

  function token(key: EquationPayload['missing'], label: string) {
    return missing === key ? <Blank /> : <span style={tokenStyle}>{label}</span>
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18, flexWrap: 'wrap' }}>
      {token('left', String(left))}
      {token('operator', operator)}
      {token('right', String(right))}
      <span style={tokenStyle}>=</span>
      {token('answer', String(answer))}
    </div>
  )
}

function toTileAssemblyItem(item: Item): TileAssemblyItem {
  const payload = item.payload as unknown as EquationPayload
  const correctLabel = String(payload[payload.missing])
  const tiles = item.payload['tiles'] as string[]
  return {
    kind: 'equation',
    instruction: 'Pick the tile that completes the equation',
    spoken: correctLabel,
    slots: 1,
    answer: [correctLabel],
    // Tile labels can repeat across the tray only if generation produced a
    // duplicate (it doesn't — see equation_builder's dedup), but index-suffix
    // the id anyway so this stays safe the same way syllable_builder's does.
    tiles: tiles.map((label, i) => ({ id: `${label}-${i}`, label })),
  }
}

function equationText(payload: EquationPayload): string {
  return `${payload.left} ${payload.operator} ${payload.right} = ${payload.answer}`
}

type Phase = 'start' | 'playing' | 'complete'

interface Props {
  profileId: number
  profileName?: string
  onBack: () => void
}

export function EquationBuilder({ profileId, onBack }: Props) {
  const [item, setItem] = useState<Item | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [posting, setPosting] = useState(false)
  const [lastResult, setLastResult] = useState<AttemptRead | null>(null)
  const [startedAt, setStartedAt] = useState<number>(0)
  const [sessionId, setSessionId] = useState<string>(() => crypto.randomUUID())
  const [solvedEquations, setSolvedEquations] = useState<string[]>([])
  const [phase, setPhase] = useState<Phase>('start')
  const [ratingHandled, setRatingHandled] = useState(false)
  // Guards against double-counting a double-submit of the same item, same
  // reasoning as syllable_builder's countedItemIds.
  const countedItemIds = useRef<Set<string>>(new Set())
  const fetchedForSession = useRef<string | null>(null)

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
    if (phase !== 'playing') return
    if (fetchedForSession.current === sessionId) return
    fetchedForSession.current = sessionId
    fetchItem()
  }, [phase, sessionId, fetchItem])

  function playAgainSession() {
    setSolvedEquations([])
    setPhase('start')
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

  async function handleResult(result: TileResult) {
    if (!item) return
    const payload = item.payload as unknown as EquationPayload
    let justCompletedSession = false
    if (result.correct && !countedItemIds.current.has(item.item_id)) {
      countedItemIds.current.add(item.item_id)
      setSolvedEquations((prev) => {
        const next = [...prev, equationText(payload)]
        justCompletedSession = next.length >= SESSION_LENGTH
        return next
      })
    }
    setPosting(true)
    setError(null)
    const timeMs = Math.round(performance.now() - startedAt)
    const attemptPayload: AttemptCreate = {
      item_id: item.item_id,
      profile_id: profileId,
      game_id: item.game_id,
      session_id: sessionId,
      telemetry: { correct: result.correct, hints_used: result.hintsUsed, time_ms: timeMs },
      details: { placement: result.placement, missing: payload.missing },
    }
    try {
      const res = await fetch('/api/attempts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(attemptPayload),
      })
      if (!res.ok) throw new Error(`POST /api/attempts -> ${res.status}`)
      const attemptResult: AttemptRead = await res.json()
      setLastResult(attemptResult)
      if (justCompletedSession) {
        setTimeout(() => setPhase('complete'), 900)
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
            <ProgressBar total={SESSION_LENGTH} currentIndex={solvedEquations.length} onBack={onBack} />
          </div>
        )}

        {error && (
          <pre style={{ color: '#CD2A20', background: '#FDF2F2', padding: 12, borderRadius: 12 }}>Error: {error}</pre>
        )}

        {phase === 'start' && (
          <SessionStart
            eyebrow="Number sense"
            headline="Let's build some equations"
            subtitle="Figure out the missing piece and pop it into place. Take your time — there's no clock."
            sessionLength={SESSION_LENGTH}
            heroSrc={`/images/badges/${GAME_ID}.png`}
            onStart={() => setPhase('playing')}
            onBack={onBack}
          />
        )}

        {phase === 'complete' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {!ratingHandled && <RatingPrompt onRate={submitRating} onDismiss={() => setRatingHandled(true)} />}
            <SessionComplete
              headline="You solved them all!"
              subtitle="Five equations, all figured out. Great thinking."
              badgeSrc={`/images/badges/${GAME_ID}.png`}
              badgeTitle="Equation Ace badge"
              words={solvedEquations}
              itemsLabel="Equations you solved"
              onPlayAgain={playAgainSession}
              onAllDone={onBack}
            />
          </div>
        )}

        {phase === 'playing' && item && (
          <div style={{ display: 'flex', justifyContent: 'center', background: 'var(--surface-default)', border: '1px solid var(--border-subtle)', borderRadius: 24, padding: '32px 28px', boxShadow: 'var(--elevation-300)' }}>
            <EquationDisplay payload={item.payload as unknown as EquationPayload} />
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
