import { useMemo, useState } from 'react'
import { DenButton } from './den/DenButton'
import { PathfinderBoard } from './PathfinderBoard'
import { coordKey } from '../lib/pathfinderRules'
import { solvePuzzle } from '../lib/pathfinderSolver'
import { assessDifficulty } from '../lib/pathfinderDifficulty'
import { makeCustomMapId, nextDefaultMapName, saveCustomMap } from '../lib/pathfinderCustomMaps'
import { MAX_BOARD_DIMENSION } from '../lib/pathfinderTypes'
import type { Difficulty, DotPuzzle, GridPosition } from '../lib/pathfinderTypes'

/**
 * "Build Your Own" mode: place dots on a grid, then run the same DFS solver
 * that validates the curated levels to find out whether the board has at
 * least one full path — the spec's requirement that a solving engine tell
 * the builder whether a hand-built map is valid, not just let them play a
 * possibly-unsolvable board. When it's solvable, the found path is drawn on
 * a real `PathfinderBoard` so the shape of a working solution is visible,
 * and the difficulty-assessment engine (`pathfinderDifficulty`) reports
 * which tier the board actually landed in.
 *
 * Naming happens at save time, not while building: there's no Name field
 * here — Save prompts for one, pre-filled with an auto-incrementing default
 * ("<username>_map1", "<username>_map2", ...) so a builder can always just
 * accept the suggestion. Saved maps live in `pathfinderCustomMaps` and are
 * managed from the separate My Maps screen (rename/delete/publish/replay).
 *
 * The grid itself is deliberately a plain CSS grid of toggle buttons rather
 * than reusing `PathfinderBoard`'s SVG path-drawing view: the interaction
 * model here is "place a dot" (idempotent toggle), not "draw a path"
 * (ordered, one-way, no-revisit) — different enough that sharing the
 * component would mean threading a mode flag through path-drawing logic
 * that doesn't apply here. The solution *preview* does reuse
 * `PathfinderBoard`, in its ordinary read-only/disabled form.
 */

const MIN_SIZE = 3
const MAX_SIZE = MAX_BOARD_DIMENSION
const DEFAULT_SIZE = 6
const MIN_DOTS_TO_CHECK = 2

const TIER_LABEL: Record<Difficulty, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
  legendary: 'Legendary',
}

type CheckResult = { solvable: boolean; solution: GridPosition[] | null; tier: Difficulty | null; score: number | null } | null

interface Props {
  /** Used only to seed the default save-name suggestion ("<username>_map1"). */
  username: string
  onPlay: (puzzle: DotPuzzle) => void
  onViewMyMaps: () => void
}

function emptyGrid(): Set<string> {
  return new Set()
}

export function PathfinderEditor({ username, onPlay, onViewMyMaps }: Props) {
  const [rows, setRows] = useState(DEFAULT_SIZE)
  const [columns, setColumns] = useState(DEFAULT_SIZE)
  const [dotKeys, setDotKeys] = useState<Set<string>>(emptyGrid)
  const [checkResult, setCheckResult] = useState<CheckResult>(null)
  const [savedMessage, setSavedMessage] = useState<string | null>(null)

  const dotCount = dotKeys.size

  // Difficulty/name aren't known until Check My Puzzle / Save run — 'easy'
  // and an empty name here are just placeholders satisfying DotPuzzle's
  // shape while drafting.
  const draftPuzzle = useMemo((): DotPuzzle => {
    const dots: GridPosition[] = []
    for (const key of dotKeys) {
      const [row, col] = key.split(',').map(Number)
      dots.push({ row, col })
    }
    return { id: 'draft', name: '', difficulty: 'easy', rows, columns, dots }
  }, [dotKeys, rows, columns])

  const assessedPuzzle = useMemo((): DotPuzzle | null => {
    if (!checkResult?.tier) return null
    return { ...draftPuzzle, difficulty: checkResult.tier }
  }, [draftPuzzle, checkResult])

  function toggleCell(row: number, col: number) {
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

  function resizeGrid(nextRows: number, nextColumns: number) {
    setRows(nextRows)
    setColumns(nextColumns)
    setCheckResult(null)
    setSavedMessage(null)
    // Drop any dots that fell outside the new bounds rather than leaving
    // orphaned, unreachable state the player can no longer see or toggle.
    setDotKeys((prev) => {
      const next = new Set<string>()
      for (const key of prev) {
        const [row, col] = key.split(',').map(Number)
        if (row < nextRows && col < nextColumns) next.add(key)
      }
      return next
    })
  }

  function clearGrid() {
    setDotKeys(emptyGrid())
    setCheckResult(null)
    setSavedMessage(null)
  }

  function checkPuzzle() {
    // Only reachable once canCheck is true (the button that calls this is
    // disabled otherwise, and a disabled DenButton drops its onClick
    // entirely), so dotCount is already known to be at least MIN_DOTS_TO_CHECK.
    const solveResult = solvePuzzle(draftPuzzle)
    const assessment = assessDifficulty(draftPuzzle, solveResult)
    setCheckResult({ solvable: solveResult.solved, solution: solveResult.path, tier: assessment.tier, score: assessment.score })
    setSavedMessage(null)
  }

  function playNow() {
    if (assessedPuzzle) onPlay({ ...assessedPuzzle, name: assessedPuzzle.name || 'My Map', id: makeCustomMapId() })
  }

  function saveMap() {
    if (!assessedPuzzle) return
    const suggested = nextDefaultMapName(username)
    const chosen = window.prompt('Name your map:', suggested)
    if (chosen === null) return // cancelled
    const name = chosen.trim() || suggested
    saveCustomMap({ ...assessedPuzzle, id: makeCustomMapId(), name })
    setSavedMessage(`Saved as "${name}" — find it under My Maps.`)
  }

  const canCheck = dotCount >= MIN_DOTS_TO_CHECK
  const canPlay = checkResult?.solvable === true && assessedPuzzle !== null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, alignItems: 'center' }}>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: 'var(--fg-secondary)' }}>
          Rows
          <input
            type="number"
            min={MIN_SIZE}
            max={MAX_SIZE}
            value={rows}
            onChange={(e) => resizeGrid(clamp(Number(e.target.value)), columns)}
            style={{ width: 56, padding: '4px 8px', borderRadius: 8, border: '1px solid var(--border-default)' }}
          />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: 'var(--fg-secondary)' }}>
          Columns
          <input
            type="number"
            min={MIN_SIZE}
            max={MAX_SIZE}
            value={columns}
            onChange={(e) => resizeGrid(rows, clamp(Number(e.target.value)))}
            style={{ width: 56, padding: '4px 8px', borderRadius: 8, border: '1px solid var(--border-default)' }}
          />
        </label>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-tertiary)' }}>Max {MAX_SIZE}x{MAX_SIZE}</span>
        <DenButton label="My Maps" variant="quiet" onClick={onViewMyMaps} />
      </div>

      <div
        role="group"
        aria-label={`Puzzle builder grid, ${rows} rows by ${columns} columns`}
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${columns}, 36px)`,
          gridTemplateRows: `repeat(${rows}, 36px)`,
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
                aria-label={`Grid cell row ${row + 1}, column ${col + 1}${on ? ', dot placed' : ', empty'}`}
                onClick={() => toggleCell(row, col)}
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
        {checkResult?.solvable && checkResult.tier && (
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--green-900)' }}>
            ✅ Solvable! Assessed difficulty: {TIER_LABEL[checkResult.tier]} (score {checkResult.score})
          </span>
        )}
        {checkResult && !checkResult.solvable && (
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--fg-warning)' }}>
            ❌ Not solvable yet — try adding, removing, or rearranging dots.
          </span>
        )}
      </div>

      {canPlay && checkResult?.solution && assessedPuzzle && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--fg-secondary)' }}>Here's a solution:</div>
          <PathfinderBoard puzzle={assessedPuzzle} path={checkResult.solution} onDotClick={() => {}} disabled />
        </div>
      )}

      {canPlay && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
            <DenButton label="Play" variant="primary" onClick={playNow} />
            <DenButton label="Save" variant="quiet" onClick={saveMap} />
          </div>
          {savedMessage && (
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--green-900)' }} aria-live="polite">
              {savedMessage}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function clamp(value: number): number {
  if (Number.isNaN(value)) return MIN_SIZE
  return Math.min(MAX_SIZE, Math.max(MIN_SIZE, Math.round(value)))
}
