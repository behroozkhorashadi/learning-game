import { useCallback, useEffect, useState } from 'react'
import type { AttemptCreate, AttemptRead, Item } from '../types/generated'
import { TileAssembly, type TileAssemblyItem, type TileResult } from '../components/TileAssembly'

/**
 * Syllable Builder item screen — ported from the Claude Design handoff
 * bundle (`Syllable Builder.dc.html`). Renders whatever Item and level the
 * server hands back and posts a full telemetry-core Attempt; it does not
 * decide difficulty or generate items itself (PRD §6).
 */

const GAME_ID = 'syllable_builder'

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
    tiles: tiles.map((syllable) => ({ id: syllable, label: syllable })),
  }
}

interface Props {
  profileId: number
  onBack: () => void
}

export function SyllableBuilder({ profileId, onBack }: Props) {
  const [item, setItem] = useState<Item | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [posting, setPosting] = useState(false)
  const [lastResult, setLastResult] = useState<AttemptRead | null>(null)
  const [startedAt, setStartedAt] = useState<number>(0)

  const fetchItem = useCallback(async () => {
    setError(null)
    setLastResult(null)
    try {
      const res = await fetch(`/api/items/next?profile_id=${profileId}&game_id=${GAME_ID}`)
      if (!res.ok) throw new Error(`GET /api/items/next -> ${res.status}`)
      const next: Item = await res.json()
      setItem(next)
      setStartedAt(performance.now())
    } catch (err) {
      setError(String(err))
    }
  }, [profileId])

  useEffect(() => {
    fetchItem()
  }, [fetchItem])

  async function handleResult(result: TileResult) {
    if (!item) return
    setPosting(true)
    setError(null)
    const timeMs = Math.round(performance.now() - startedAt)
    const payload: AttemptCreate = {
      item_id: item.item_id,
      profile_id: profileId,
      game_id: item.game_id,
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
      setLastResult(await res.json())
    } catch (err) {
      setError(String(err))
    } finally {
      setPosting(false)
    }
  }

  return (
    <div style={{ minHeight: '100%', boxSizing: 'border-box', background: 'var(--surface-app)', display: 'flex', justifyContent: 'center', padding: '32px 24px 56px' }}>
      <div style={{ width: '100%', maxWidth: 760, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 26 }}>
          <button
            type="button"
            aria-label="Back"
            title="Back"
            onClick={onBack}
            style={{ width: 52, height: 52, borderRadius: 9999, border: '2px solid var(--border-default)', background: '#FFFFFF', color: 'var(--fg-secondary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          >
            ←
          </button>
        </div>

        {error && (
          <pre style={{ color: '#CD2A20', background: '#FDF2F2', padding: 12, borderRadius: 12 }}>Error: {error}</pre>
        )}

        {item && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap', background: 'var(--surface-default)', border: '1px solid var(--border-subtle)', borderRadius: 24, padding: '24px 28px', boxShadow: 'var(--elevation-300)' }}>
            <div style={{ flex: 'none', width: 132, height: 132, borderRadius: 22, overflow: 'hidden', background: 'var(--surface-subtle)', border: '1px solid var(--border-tray)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 56 }}>
              🧩
            </div>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.09em', textTransform: 'uppercase', fontWeight: 700, color: 'var(--fg-tertiary)', marginBottom: 8 }}>
                Listen, then build the word
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => {
                    try {
                      window.speechSynthesis?.cancel()
                      window.speechSynthesis?.speak(new SpeechSynthesisUtterance(item.payload['target_word'] as string))
                    } catch {
                      // speech synthesis is a nice-to-have; ignore if unavailable
                    }
                  }}
                  aria-label="Hear the word"
                  title="Hear the word"
                  style={{ width: 56, height: 56, borderRadius: 9999, border: '2px solid #C2D1FF', background: '#F0F4FF', color: '#144FFF', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flex: 'none' }}
                >
                  🔊
                </button>
                <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 20, color: 'var(--fg-primary)' }}>Tap to hear the word</span>
              </div>
              <div style={{ marginTop: 10, fontSize: 16, lineHeight: '22px', color: 'var(--fg-tertiary)' }}>
                Tap a sound to place it, or drag it into a box.
              </div>
            </div>
          </div>
        )}

        {item && (
          <div style={{ marginTop: 28 }}>
            <TileAssembly key={item.item_id} item={toTileAssemblyItem(item)} onResult={handleResult} embedded showAudio={false} />
          </div>
        )}

        {posting && <p style={{ color: 'var(--fg-tertiary)' }}>Saving...</p>}
        {lastResult && !posting && (
          <p style={{ color: 'var(--fg-tertiary)', fontSize: 14 }}>
            Recorded (event {lastResult.event_id.slice(0, 8)}) — level stays server-owned for the next item.
          </p>
        )}
      </div>
    </div>
  )
}
