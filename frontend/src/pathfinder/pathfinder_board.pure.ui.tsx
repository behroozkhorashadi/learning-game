import type { ReactElement } from 'react'
import { coordKey, visitedKeySet } from './pathfinder_rules.pure.lib.ts'
import type { DotPuzzle, GridPosition } from './pathfinder_state.pure.lib.ts'

/**
 * Pure presentation: renders the grid, the path so far, and reports clicks —
 * it has no opinion about whether a click is a legal move. The play hook
 * (use_pathfinder_play.pure.hook.ts) owns that decision so validation logic isn't duplicated here.
 *
 * An SVG with a fixed internal `viewBox` is used instead of absolutely
 * positioned DOM nodes so the board scales with CSS width alone: dots and
 * lines are computed from the same coordinate space, so they can never drift
 * out of alignment on resize.
 */

const CELL = 64
const PADDING = 32
const DOT_RADIUS = 14
const HIT_RADIUS = 24

export interface PathfinderBoardProps {
  readonly puzzle: DotPuzzle
  readonly path: readonly GridPosition[]
  readonly onDotClick: (pos: GridPosition) => void
  readonly disabled?: boolean
}

function centerOf(pos: GridPosition): { x: number; y: number } {
  return { x: PADDING + pos.col * CELL, y: PADDING + pos.row * CELL }
}

export function PathfinderBoard({ puzzle, path, onDotClick, disabled = false }: PathfinderBoardProps): ReactElement {
  const width = PADDING * 2 + (puzzle.columns - 1) * CELL
  const height = PADDING * 2 + (puzzle.rows - 1) * CELL
  const visited = visitedKeySet(path)
  const first = path.at(0)
  const last = path.at(-1)
  const startKey = first === undefined ? null : coordKey(first)
  const currentKey = last === undefined ? null : coordKey(last)
  const segments = path.slice(1).map((to, i) => ({ from: path[i] ?? to, to }))

  return (
    <svg
      viewBox={`0 0 ${String(width)} ${String(height)}`}
      width="100%"
      height="auto"
      style={{ display: 'block', maxWidth: width, margin: '0 auto', touchAction: 'manipulation' }}
      role="group"
      aria-label={`Pathfinder board, ${String(puzzle.rows)} rows by ${String(puzzle.columns)} columns`}
    >
      {/* Segments drawn first so they render behind the dots. */}
      <g>
        {segments.map((segment) => {
          const from = centerOf(segment.from)
          const to = centerOf(segment.to)
          return (
            <line
              key={`${coordKey(segment.from)}-${coordKey(segment.to)}`}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke="var(--blue-800)"
              strokeWidth={7}
              strokeLinecap="round"
              style={{
                animation: 'pathfinderSegmentIn 180ms ease-out',
              }}
            />
          )
        })}
      </g>

      <g>
        {puzzle.dots.map((dot) => {
          const key = coordKey(dot)
          const { x, y } = centerOf(dot)
          const isVisited = visited.has(key)
          const isCurrent = key === currentKey
          const isStart = key === startKey

          let fill = 'var(--gray-300)'
          let stroke = 'var(--gray-500)'
          if (isVisited) {
            fill = 'var(--blue-600)'
            stroke = 'var(--blue-800)'
          }
          if (isCurrent) {
            fill = 'var(--purple-700)'
            stroke = 'var(--purple-800)'
          }

          return (
            <g key={key}>
              {isStart && (
                <circle cx={x} cy={y} r={DOT_RADIUS + 6} fill="none" stroke="var(--orange-700)" strokeWidth={3} />
              )}
              {isCurrent && (
                <circle cx={x} cy={y} r={DOT_RADIUS + 5} fill="none" stroke="var(--purple-700)" strokeWidth={2} style={{ animation: 'pulseRing 1.4s ease-out infinite' }} />
              )}
              <circle
                cx={x}
                cy={y}
                r={HIT_RADIUS}
                fill="transparent"
                style={{ cursor: disabled ? 'default' : 'pointer' }}
                onPointerUp={() => {
                  if (!disabled) onDotClick(dot)
                }}
                role="button"
                aria-label={`Dot at row ${String(dot.row + 1)}, column ${String(dot.col + 1)}${isVisited ? ', visited' : ''}`}
              />
              <circle cx={x} cy={y} r={DOT_RADIUS} fill={fill} stroke={stroke} strokeWidth={2} pointerEvents="none" />
            </g>
          )
        })}
      </g>
    </svg>
  )
}
