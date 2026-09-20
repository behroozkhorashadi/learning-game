import { useEffect, useState } from 'react'
import { DenButton } from '../components/den/DenButton'
import type { PracticeConfig } from '../types/generated'

/**
 * Practice settings for Equation Outbreak — lets a parent pick which
 * operations are in play, bias practice toward specific fact-family numbers
 * per operation (e.g. "focus on 7 and 8" for multiplication), and pin an
 * explicit difficulty. Backed by GET/PUT/DELETE /api/practice-config — see
 * that endpoint's docstring in backend/app/main.py and
 * backend/app/models/practice_config.py for the server-side story
 * (including the documented tradeoff with the adaptive Level engine).
 *
 * Reached via the gear icon GamePicker.tsx shows on this game's tile.
 */

const GAME_ID = 'fact_fluency'

const OPERATIONS = [
  { key: '+', label: 'Addition' },
  { key: '-', label: 'Subtraction' },
  { key: '×', label: 'Multiplication' },
  { key: '÷', label: 'Division' },
]

// Every operator's focus picker offers the same range — unusable values (e.g.
// an 11 focus at a low difficulty whose operand ceiling is smaller) are
// silently ignored server-side (see draw_operands_with_focus's `usable`
// filter), so there's no need to vary this per operator or difficulty.
const FOCUS_NUMBER_OPTIONS = Array.from({ length: 12 }, (_, i) => i + 1)

const MIN_DIFFICULTY = 1
const MAX_DIFFICULTY = 10

function difficultyLabel(value: number): string {
  if (value <= 2) return 'Warm-up'
  if (value <= 4) return 'Building confidence'
  if (value <= 7) return 'Steady challenge'
  return 'Advanced'
}

interface Props {
  profileId: number
  onBack: () => void
}

export function EquationOutbreakSettings({ profileId, onBack }: Props) {
  const [loading, setLoading] = useState(true)
  const [hadExistingConfig, setHadExistingConfig] = useState(false)
  const [customEnabled, setCustomEnabled] = useState(false)
  const [operations, setOperations] = useState<Set<string>>(new Set(['+', '-', '×', '÷']))
  const [focusNumbers, setFocusNumbers] = useState<Record<string, number[]>>({})
  const [difficulty, setDifficulty] = useState(5)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/practice-config?profile_id=${profileId}&game_id=${GAME_ID}`)
      .then(async (res) => {
        if (res.status === 404) return null
        if (!res.ok) throw new Error(`GET /api/practice-config -> ${res.status}`)
        return (await res.json()) as PracticeConfig
      })
      .then((config) => {
        if (config) {
          setHadExistingConfig(true)
          setCustomEnabled(true)
          setOperations(new Set(config.operations))
          setFocusNumbers((config.focus_numbers as Record<string, number[]>) ?? {})
          setDifficulty(config.difficulty)
        }
        setLoading(false)
      })
      .catch((err) => {
        setError(String(err))
        setLoading(false)
      })
  }, [profileId])

  function toggleOperation(op: string) {
    setOperations((prev) => {
      const next = new Set(prev)
      if (next.has(op)) {
        if (next.size === 1) return prev // always keep at least one
        next.delete(op)
      } else {
        next.add(op)
      }
      return next
    })
  }

  function toggleFocusNumber(op: string, value: number) {
    setFocusNumbers((prev) => {
      const current = prev[op] ?? []
      const next = current.includes(value) ? current.filter((n) => n !== value) : [...current, value]
      return { ...prev, [op]: next }
    })
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      if (customEnabled) {
        const res = await fetch('/api/practice-config', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            profile_id: profileId,
            game_id: GAME_ID,
            operations: Array.from(operations),
            focus_numbers: focusNumbers,
            difficulty,
          }),
        })
        if (!res.ok) {
          const body = await res.json().catch(() => null)
          throw new Error(body?.detail ?? `PUT /api/practice-config -> ${res.status}`)
        }
        setHadExistingConfig(true)
      } else if (hadExistingConfig) {
        const res = await fetch(`/api/practice-config?profile_id=${profileId}&game_id=${GAME_ID}`, { method: 'DELETE' })
        if (!res.ok) throw new Error(`DELETE /api/practice-config -> ${res.status}`)
        setHadExistingConfig(false)
      }
      onBack()
    } catch (err) {
      setError(String(err))
    } finally {
      setSaving(false)
    }
  }

  if (loading) return null

  return (
    <div style={{ minHeight: '100%', boxSizing: 'border-box', background: 'var(--surface-app)', display: 'flex', justifyContent: 'center', padding: '56px 24px' }}>
      <div style={{ width: '100%', maxWidth: 640, background: 'var(--surface-default)', border: '1px solid var(--border-subtle)', borderRadius: 32, padding: '44px 40px', boxShadow: 'var(--elevation-600)' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 30, color: 'var(--fg-primary)', textAlign: 'center' }}>
          Equation Outbreak
        </div>
        <div style={{ marginTop: 8, fontSize: 16, color: 'var(--fg-tertiary)', textAlign: 'center' }}>Practice settings</div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 32, cursor: 'pointer' }}>
          <input type="checkbox" checked={customEnabled} onChange={(e) => setCustomEnabled(e.target.checked)} style={{ width: 20, height: 20 }} />
          <span style={{ fontWeight: 700, color: 'var(--fg-secondary)' }}>Customize which problems appear</span>
        </label>
        <div style={{ marginTop: 4, marginLeft: 30, fontSize: 14, color: 'var(--fg-tertiary)' }}>
          {customEnabled
            ? 'Overrides automatic difficulty until you turn this off.'
            : 'Check this to pick operations, focus numbers, and difficulty yourself — off, difficulty adjusts automatically as they play.'}
        </div>

        <div
          // Always rendered (rather than only when checked) so it's obvious
          // there's more here to turn on, not just a bare checkbox — the
          // grayed-out/inert state is the discoverability cue.
          aria-hidden={!customEnabled}
          style={{
            opacity: customEnabled ? 1 : 0.4,
            pointerEvents: customEnabled ? 'auto' : 'none',
            transition: 'opacity 120ms ease',
          }}
        >
          <div style={{ marginTop: 28 }}>
            <span style={{ display: 'block', marginBottom: 8, fontWeight: 700, color: 'var(--fg-secondary)' }}>Operations</span>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {OPERATIONS.map((op) => {
                const active = operations.has(op.key)
                return (
                  <button
                    key={op.key}
                    type="button"
                    onClick={() => toggleOperation(op.key)}
                    aria-pressed={active}
                    title={op.label}
                    style={{
                      padding: '10px 18px',
                      borderRadius: 14,
                      fontWeight: 700,
                      fontSize: 18,
                      cursor: 'pointer',
                      background: active ? 'var(--blue-100)' : 'var(--surface-subtle)',
                      border: active ? '2px solid var(--fg-brand)' : '2px solid var(--border-default)',
                      color: 'var(--fg-primary)',
                    }}
                  >
                    {op.key}
                  </button>
                )
              })}
            </div>
          </div>

          {OPERATIONS.filter((op) => operations.has(op.key)).map((op) => (
            <div key={op.key} style={{ marginTop: 24 }}>
              <span style={{ display: 'block', marginBottom: 8, fontWeight: 700, color: 'var(--fg-secondary)' }}>
                Focus numbers for {op.label.toLowerCase()} <span style={{ fontWeight: 400, color: 'var(--fg-tertiary)' }}>(optional)</span>
              </span>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {FOCUS_NUMBER_OPTIONS.map((n) => {
                  const active = (focusNumbers[op.key] ?? []).includes(n)
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => toggleFocusNumber(op.key, n)}
                      aria-pressed={active}
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 9999,
                        fontWeight: 700,
                        fontSize: 14,
                        cursor: 'pointer',
                        background: active ? 'var(--blue-100)' : 'var(--surface-subtle)',
                        border: active ? '2px solid var(--fg-brand)' : '2px solid var(--border-default)',
                        color: 'var(--fg-primary)',
                      }}
                    >
                      {n}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}

          <div style={{ marginTop: 28 }}>
            <span style={{ display: 'block', marginBottom: 8, fontWeight: 700, color: 'var(--fg-secondary)' }}>
              Difficulty — {difficultyLabel(difficulty)} ({difficulty}/{MAX_DIFFICULTY})
            </span>
            <input
              type="range"
              min={MIN_DIFFICULTY}
              max={MAX_DIFFICULTY}
              value={difficulty}
              onChange={(e) => setDifficulty(Number(e.target.value))}
              style={{ width: '100%' }}
            />
            <div style={{ fontSize: 13, color: 'var(--fg-tertiary)' }}>Bigger numbers and less time to answer as this goes up.</div>
          </div>
        </div>

        {error && <div style={{ marginTop: 20, color: '#CD2A20', background: '#FDF2F2', padding: 12, borderRadius: 12 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 12, marginTop: 32 }}>
          <DenButton label="Cancel" variant="quiet" size="lg" onClick={onBack} />
          <div style={{ flex: 1 }}>
            <DenButton label={saving ? 'Saving…' : 'Save'} size="lg" full disabled={saving} onClick={handleSave} />
          </div>
        </div>
      </div>
    </div>
  )
}
