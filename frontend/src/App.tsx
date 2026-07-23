import { useState } from 'react'
import type { AttemptCreate, AttemptRead, Item } from './types/generated'

/**
 * Placeholder shell — PRD §16 step 2/3. No rendering, no game interaction:
 * fetches an Item and dumps it as raw text, and can post back a hardcoded
 * but valid Attempt. Real game rendering is a later milestone.
 */
function App() {
  const [item, setItem] = useState<Item | null>(null)
  const [result, setResult] = useState<AttemptRead | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function fetchItem() {
    setError(null)
    setResult(null)
    try {
      const res = await fetch('/api/items/next?profile_id=1&game_id=syllable_builder')
      if (!res.ok) throw new Error(`GET /api/items/next -> ${res.status}`)
      setItem(await res.json())
    } catch (err) {
      setError(String(err))
    }
  }

  async function postHardcodedResult() {
    if (!item) return
    setError(null)
    const payload: AttemptCreate = {
      item_id: item.item_id,
      profile_id: 1,
      game_id: item.game_id,
      telemetry: { correct: true, hints_used: 0, time_ms: 4200 },
      details: { assembled: item.payload['correct_syllables'] },
    }
    try {
      const res = await fetch('/api/attempts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error(`POST /api/attempts -> ${res.status}`)
      setResult(await res.json())
    } catch (err) {
      setError(String(err))
    }
  }

  return (
    <div>
      <h1>Adaptive Learning Games — placeholder shell</h1>
      <button onClick={fetchItem}>Fetch next item</button>
      <button onClick={postHardcodedResult} disabled={!item}>
        Post hardcoded result
      </button>
      {error && <pre>Error: {error}</pre>}
      <h2>Item (raw)</h2>
      <pre>{item ? JSON.stringify(item, null, 2) : '(none fetched yet)'}</pre>
      <h2>Attempt result (raw)</h2>
      <pre>{result ? JSON.stringify(result, null, 2) : '(none posted yet)'}</pre>
    </div>
  )
}

export default App
