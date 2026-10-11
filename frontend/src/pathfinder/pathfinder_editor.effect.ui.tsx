import { useMemo, useState, type ComponentType, type ReactElement } from 'react'
import { DenButton } from '@app/den/den_button.pure.ui.tsx'
import { PathfinderBoard } from './pathfinder_board.pure.ui.tsx'
import { makeCustomMapId, nextDefaultMapName } from './pathfinder_custom_maps.pure.lib.ts'
import { assessDifficulty } from './pathfinder_difficulty.pure.lib.ts'
import { coordKey, parseCoordKey } from './pathfinder_rules.pure.lib.ts'
import { solvePuzzle } from './pathfinder_solver.pure.lib.ts'
import { MAX_BOARD_DIMENSION, type Dialogs, type Difficulty, type DotPuzzle, type GridPosition, type MapLibrary } from './pathfinder_state.pure.lib.ts'

/**
 * "Build Your Own" mode: place dots on a grid, then run the same DFS solver
 * that validates the curated levels to find out whether the board has at
 * least one full path — the spec's requirement that a solving engine tell
 * the builder whether a hand-built map is valid, not just let them play a
 * possibly-unsolvable board. When it's solvable, the found path is drawn on
 * a real `PathfinderBoard` so the shape of a working solution is visible,
 * and the difficulty-assessment engine (`pathfinder_difficulty`) reports
 * which tier the board actually landed in.
 *
 * Naming happens at save time, not while building: there's no Name field
 * here — Save prompts for one, pre-filled with an auto-incrementing default
 * ("<username>_map1", "<username>_map2", ...) so a builder can always just
 * accept the suggestion. Saved maps are managed from the separate My Maps
 * screen (rename/delete/publish/replay).
 *
 * The grid itself is deliberately a plain CSS grid of toggle buttons rather
 * than reusing `PathfinderBoard`'s SVG path-drawing view: the interaction
 * model here is "place a dot" (idempotent toggle), not "draw a path"
 * (ordered, one-way, no-revisit). The solution *preview* does reuse
 * `PathfinderBoard`, in its ordinary read-only/disabled form.
 */

const MIN_SIZE = 3
const MAX_SIZE = MAX_BOARD_DIMENSION
const DEFAULT_SIZE = 6
const MIN_DOTS_TO_CHECK = 2

const TIER_LABEL: Readonly<Record<Difficulty, string>> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
  legendary: 'Legendary',
}

interface CheckResult {
  readonly solvable: boolean
  readonly solution: readonly GridPosition[] | null
  readonly tier: Difficulty | null
  readonly score: number | null
}

export interface PathfinderEditorProps {
  /** Whose My Maps library a saved map goes to. */
  readonly profileId: number
  /** Used only to seed the default save-name suggestion ("<username>_map1"). */
  readonly username: string
  readonly onPlay: (puzzle: DotPuzzle) => void
  readonly onViewMyMaps: () => void
}

export interface PathfinderEditorDeps {
  readonly maps: Pick<MapLibrary, 'listMaps' | 'saveMap'>
  readonly dialogs: Pick<Dialogs, 'prompt'>
  /** A random UUID, for a new map's stable id. */
  readonly randomId: () => string
}

function clamp(value: number): number {
  if (Number.isNaN(value)) return MIN_SIZE
  return Math.min(MAX_SIZE, Math.max(MIN_SIZE, Math.round(value)))
}

/**
 * Number box for a grid dimension. Holds the raw text while typing so a
 * multi-digit size can pass through an out-of-range prefix — typing "12"
 * goes via "1", which clamping on every keystroke would snap to 3 before
 * the "2" ever arrived. In-range values apply live; anything else is
 * clamped once the field loses focus (or Enter is pressed).
 */
function SizeInput({ label, value, onCommit }: { readonly label: string; readonly value: number; readonly onCommit: (n: number) => void }): ReactElement {
  const [draft, setDraft] = useState<string | null>(null)

  function commit(): void {
    if (draft === null) return
    const n = clamp(draft === '' ? Number.NaN : Number(draft))
    setDraft(null)
    if (n !== value) onCommit(n)
  }

  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: 'var(--fg-secondary)' }}>
      {label}
      <input
        type="number"
        min={MIN_SIZE}
        max={MAX_SIZE}
        value={draft ?? value}
        onChange={(e) => {
          const text = e.target.value
          setDraft(text)
          const n = Number(text)
          if (text !== '' && Number.isInteger(n) && n >= MIN_SIZE && n <= MAX_SIZE && n !== value) onCommit(n)
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
        }}
        style={{ width: 56, padding: '4px 8px', borderRadius: 8, border: '1px solid var(--border-default)' }}
      />
    </label>
  )
}

export function bindPathfinderEditor({ maps, dialogs, randomId }: PathfinderEditorDeps): ComponentType<PathfinderEditorProps> {
  function PathfinderEditor({ profileId, username, onPlay, onViewMyMaps }: PathfinderEditorProps): ReactElement {
    const [rows, setRows] = useState(DEFAULT_SIZE)
    const [columns, setColumns] = useState(DEFAULT_SIZE)
    const [dotKeys, setDotKeys] = useState<ReadonlySet<string>>(() => new Set())
    const [checkResult, setCheckResult] = useState<CheckResult | null>(null)
    const [savedMessage, setSavedMessage] = useState<string | null>(null)

    const dotCount = dotKeys.size

    // Difficulty/name aren't known until Check My Puzzle / Save run — 'easy'
    // and an empty name here are just placeholders satisfying DotPuzzle's
    // shape while drafting.
    const draftPuzzle = useMemo((): DotPuzzle => ({ id: 'draft', name: '', difficulty: 'easy', rows, columns, dots: [...dotKeys].map(parseCoordKey) }), [dotKeys, rows, columns])

    const assessedPuzzle: DotPuzzle | null = checkResult?.tier == null ? null : { ...draftPuzzle, difficulty: checkResult.tier }

    function toggleCell(row: number, col: number): void {
      setCheckResult(null)
      setSavedMessage(null)
      const key = coordKey({ row, col })
      setDotKeys((prev) => {
        const next = new Set(prev)
        if (next.has(key)) next.delete(key)
        else next.add(key)
        return next
      })
    }

    function resizeGrid(nextRows: number, nextColumns: number): void {
      setRows(nextRows)
      setColumns(nextColumns)
      setCheckResult(null)
      setSavedMessage(null)
      // Drop any dots that fell outside the new bounds rather than leaving
      // orphaned, unreachable state the player can no longer see or toggle.
      setDotKeys((prev) => new Set([...prev].filter((key) => {
        const { row, col } = parseCoordKey(key)
        return row < nextRows && col < nextColumns
      })))
    }

    function clearGrid(): void {
      setDotKeys(new Set())
      setCheckResult(null)
      setSavedMessage(null)
    }

    function checkPuzzle(): void {
      // Only reachable once canCheck is true (a disabled DenButton drops its
      // onClick), so there are at least MIN_DOTS_TO_CHECK dots.
      const solveResult = solvePuzzle(draftPuzzle)
      const assessment = assessDifficulty(draftPuzzle, solveResult)
      setCheckResult({ solvable: solveResult.solved, solution: solveResult.path, tier: assessment.tier, score: assessment.score })
      setSavedMessage(null)
    }

    function playNow(): void {
      if (assessedPuzzle === null) return
      onPlay({ ...assessedPuzzle, name: assessedPuzzle.name === undefined || assessedPuzzle.name === '' ? 'My Map' : assessedPuzzle.name, id: makeCustomMapId(randomId) })
    }

    async function saveMap(): Promise<void> {
      if (assessedPuzzle === null) return
      try {
        const suggested = nextDefaultMapName(username, await maps.listMaps(profileId))
        const chosen = dialogs.prompt('Name your map:', suggested)
        if (chosen === null) return // cancelled
        const name = chosen.trim() === '' ? suggested : chosen.trim()
        await maps.saveMap(profileId, { ...assessedPuzzle, id: makeCustomMapId(randomId), name })
        setSavedMessage(`Saved as "${name}" — find it under My Maps.`)
      } catch {
        setSavedMessage("Couldn't save your map — is the server running?")
      }
    }

    const canCheck = dotCount >= MIN_DOTS_TO_CHECK
    const canPlay = checkResult?.solvable === true && assessedPuzzle !== null

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center' }}>
          <SizeInput
            label="Rows"
            value={rows}
            onCommit={(n) => {
              resizeGrid(n, columns)
            }}
          />
          <SizeInput
            label="Columns"
            value={columns}
            onCommit={(n) => {
              resizeGrid(rows, n)
            }}
          />
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-tertiary)' }}>
            Max {MAX_SIZE}x{MAX_SIZE}
          </span>
          <DenButton label="My Maps" variant="quiet" onClick={onViewMyMaps} />
        </div>

        <div
          role="group"
          aria-label={`Puzzle builder grid, ${String(rows)} rows by ${String(columns)} columns`}
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${String(columns)}, 36px)`,
            gridTemplateRows: `repeat(${String(rows)}, 36px)`,
            gap: 6,
            maxWidth: '100%',
            overflow: 'auto',
          }}
        >
          {Array.from({ length: rows }, (_, row) =>
            Array.from({ length: columns }, (_, col) => {
              const key = coordKey({ row, col })
              const on = dotKeys.has(key)
              return (
                <button
                  key={key}
                  type="button"
                  aria-label={`Grid cell row ${String(row + 1)}, column ${String(col + 1)}${on ? ', dot placed' : ', empty'}`}
                  onClick={() => {
                    toggleCell(row, col)
                  }}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    border: `2px solid ${on ? 'var(--blue-800)' : 'var(--border-default)'}`,
                    background: on ? 'var(--blue-600)' : 'var(--surface-default)',
                    cursor: 'pointer',
                  }}
                />
              )
            }),
          )}
        </div>

        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg-secondary)' }}>{dotCount} dots placed</div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
          <DenButton label="Check My Puzzle" variant="quiet" onClick={checkPuzzle} disabled={!canCheck} />
          <DenButton label="Clear Grid" variant="quiet" onClick={clearGrid} disabled={dotCount === 0} />
        </div>

        <div style={{ minHeight: 24, textAlign: 'center' }} aria-live="polite">
          {checkResult?.solvable === true && checkResult.tier !== null && (
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--green-900)' }}>
              ✅ Solvable! Assessed difficulty: {TIER_LABEL[checkResult.tier]} (score {checkResult.score})
            </span>
          )}
          {checkResult !== null && !checkResult.solvable && (
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--fg-warning)' }}>❌ Not solvable yet — try adding, removing, or rearranging dots.</span>
          )}
        </div>

        {canPlay && checkResult.solution !== null && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--fg-secondary)' }}>Here&apos;s a solution:</div>
            <PathfinderBoard puzzle={assessedPuzzle} path={checkResult.solution} onDotClick={() => undefined} disabled />
          </div>
        )}

        {canPlay && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
              <DenButton label="Play" variant="primary" onClick={playNow} />
              <DenButton label="Save" variant="quiet" onClick={() => void saveMap()} />
            </div>
            {savedMessage !== null && (
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--green-900)' }} aria-live="polite">
                {savedMessage}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }
  return PathfinderEditor
}
