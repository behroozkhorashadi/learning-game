import { useMemo, useRef, useState } from 'react'
import { DenButton } from './den/DenButton'
import { PathfinderBoard } from './PathfinderBoard'
import { coordKey } from '../lib/pathfinderRules'
import { solvePuzzle } from '../lib/pathfinderSolver'
import { assessDifficulty } from '../lib/pathfinderDifficulty'
import { formatLevelCode, makeLevelId } from '../lib/pathfinderExport'
import { deleteCustomMap, listCustomMaps, saveCustomMap } from '../lib/pathfinderCustomMaps'
import { MAX_BOARD_DIMENSION } from '../lib/pathfinderTypes'
import type { Difficulty, DotPuzzle, GridPosition } from '../lib/pathfinderTypes'

/**
 * "Build Your Own" mode: place dots on a grid, then run the same DFS solver
 * that validates the curated levels to find out whether the board has at
 * least one full path — the spec's requirement that a solving engine tell
 * the builder whether a hand-built map is valid, not just let them play a
 * possibly-unsolvable board. When it's solvable, the found path is drawn on
 * a real `PathfinderBoard` so the shape of a working solution is visible,
 * the difficulty-assessment engine (`pathfinderDifficulty`) reports which
 * tier the board actually landed in, and the puzzle can be exported as the
 * TS snippet that goes straight into `pathfinderLevels.ts` — this component
 * has no way to write to the repo's source itself, so that's the handoff
 * point to a person doing that by hand.
 *
 * Difficulty is assessed, not picked: with player-built/published maps
 * there's no author judgment to fall back on, so the tier comes from
 * measuring the board (see pathfinderDifficulty.ts), the same source of
 * truth every curated level is now checked against.
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
  onPlay: (puzzle: DotPuzzle) => void
}

function emptyGrid(): Set<string> {
  return new Set()
}

export function PathfinderEditor({ onPlay }: Props) {
  const [rows, setRows] = useState(DEFAULT_SIZE)
  const [columns, setColumns] = useState(DEFAULT_SIZE)
  const [dotKeys, setDotKeys] = useState<Set<string>>(emptyGrid)
  const [name, setName] = useState('My Puzzle')
  const [checkResult, setCheckResult] = useState<CheckResult>(null)
  const [savedMaps, setSavedMaps] = useState<DotPuzzle[]>(() => listCustomMaps())
  const exportRef = useRef<HTMLTextAreaElement>(null)

  const dotCount = dotKeys.size

  // Difficulty isn't known until Check My Puzzle runs the assessment engine
  // — 'easy' here is just a placeholder to satisfy DotPuzzle's shape while
  // solving/drafting; `assessedPuzzle` below carries the real, measured tier.
  const draftPuzzle = useMemo((): DotPuzzle => {
    const dots: GridPosition[] = []
    for (const key of dotKeys) {
      const [row, col] = key.split(',').map(Number)
      dots.push({ row, col })
    }
    return { id: 'draft', name: name.trim() || 'My Puzzle', difficulty: 'easy', rows, columns, dots }
  }, [dotKeys, rows, columns, name])

  const assessedPuzzle = useMemo((): DotPuzzle | null => {
    if (!checkResult?.tier) return null
    return { ...draftPuzzle, difficulty: checkResult.tier, id: makeLevelId(checkResult.tier, name) }
  }, [draftPuzzle, checkResult, name])

  function toggleCell(row: number, col: number) {
    setCheckResult(null)
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
  }

  function checkPuzzle() {
    // Only reachable once canCheck is true (the button that calls this is
    // disabled otherwise, and a disabled DenButton drops its onClick
    // entirely), so dotCount is already known to be at least MIN_DOTS_TO_CHECK.
    const solveResult = solvePuzzle(draftPuzzle)
    const assessment = assessDifficulty(draftPuzzle, solveResult)
    setCheckResult({ solvable: solveResult.solved, solution: solveResult.path, tier: assessment.tier, score: assessment.score })
  }

  function selectExportText() {
    exportRef.current?.select()
  }

  function playNow() {
    if (assessedPuzzle) onPlay(assessedPuzzle)
  }

  function saveAndPlay() {
    if (!assessedPuzzle) return
    saveCustomMap(assessedPuzzle)
    setSavedMaps(listCustomMaps())
    onPlay(assessedPuzzle)
  }

  function playSaved(puzzle: DotPuzzle) {
    onPlay(puzzle)
  }

  function removeSaved(id: string) {
    deleteCustomMap(id)
    setSavedMaps(listCustomMaps())
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
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: 'var(--fg-secondary)' }}>
          Name
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            style={{ padding: '4px 8px', borderRadius: 8, border: '1px solid var(--border-default)', width: 140 }}
          />
        </label>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-tertiary)' }}>Max {MAX_SIZE}x{MAX_SIZE}</span>
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
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
          <DenButton label="Play It!" variant="primary" onClick={playNow} />
          <DenButton label="Save & Play" variant="quiet" onClick={saveAndPlay} />
        </div>
      )}

      {canPlay && assessedPuzzle && (
        <div style={{ width: '100%', maxWidth: 480, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--fg-secondary)' }}>
            Export this level (paste into <code>pathfinderLevels.ts</code>):
          </div>
          <textarea
            ref={exportRef}
            readOnly
            aria-label="Exported level code"
            onFocus={selectExportText}
            value={formatLevelCode(assessedPuzzle)}
            rows={Math.min(assessedPuzzle.dots.length + 6, 20)}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              padding: 10,
              borderRadius: 10,
              border: '1px solid var(--border-default)',
              background: 'var(--gray-100)',
              resize: 'vertical',
            }}
          />
          <DenButton label="Select Code" size="sm" variant="quiet" onClick={selectExportText} />
        </div>
      )}

      {savedMaps.length > 0 && (
        <div style={{ width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--fg-secondary)' }}>My Saved Puzzles</div>
          {savedMaps.map((puzzle) => (
            <div
              key={puzzle.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                padding: '8px 12px',
                borderRadius: 12,
                border: '1px solid var(--border-default)',
                background: 'var(--surface-default)',
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 700 }}>
                {puzzle.name}{' '}
                <span style={{ color: 'var(--fg-tertiary)', fontWeight: 600 }}>
                  ({puzzle.dots.length} dots, {TIER_LABEL[puzzle.difficulty]})
                </span>
              </span>
              <div style={{ display: 'flex', gap: 6 }}>
                <DenButton label="Play" size="sm" variant="quiet" onClick={() => playSaved(puzzle)} />
                <DenButton label="Delete" size="sm" variant="ghost" onClick={() => removeSaved(puzzle.id)} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function clamp(value: number): number {
  if (Number.isNaN(value)) return MIN_SIZE
  return Math.min(MAX_SIZE, Math.max(MIN_SIZE, Math.round(value)))
}
