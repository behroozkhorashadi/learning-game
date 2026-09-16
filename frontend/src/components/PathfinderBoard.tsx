import { coordKey, visitedKeySet } from '../lib/pathfinderRules'
import type { DotPuzzle, GridPosition } from '../lib/pathfinderTypes'

/**
 * Pure presentation: renders the grid, the path so far, and reports clicks —
 * it has no opinion about whether a click is a legal move. `Pathfinder.tsx`
 * owns that decision so validation logic isn't duplicated here.
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

interface Props {
  puzzle: DotPuzzle
  path: GridPosition[]
  onDotClick: (pos: GridPosition) => void
  disabled?: boolean
}

function centerOf(pos: GridPosition): { x: number; y: number } {
  return { x: PADDING + pos.col * CELL, y: PADDING + pos.row * CELL }
}

export function PathfinderBoard({ puzzle, path, onDotClick, disabled = false }: Props) {
  const width = PADDING * 2 + (puzzle.columns - 1) * CELL
  const height = PADDING * 2 + (puzzle.rows - 1) * CELL
  const visited = visitedKeySet(path)
  const startKey = path.length > 0 ? coordKey(path[0]) : null
  const currentKey = path.length > 0 ? coordKey(path[path.length - 1]) : null

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height="auto"
      style={{ display: 'block', maxWidth: width, margin: '0 auto', touchAction: 'manipulation' }}
      role="group"
      aria-label={`Pathfinder board, ${puzzle.rows} rows by ${puzzle.columns} columns`}
    >
      {/* Segments drawn first so they render behind the dots. */}
      <g>
        {path.slice(1).map((pos, i) => {
          const from = centerOf(path[i])
          const to = centerOf(pos)
          return (
            <line
              key={`${coordKey(path[i])}-${coordKey(pos)}`}
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
                aria-label={`Dot at row ${dot.row + 1}, column ${dot.col + 1}${isVisited ? ', visited' : ''}`}
              />
              <circle cx={x} cy={y} r={DOT_RADIUS} fill={fill} stroke={stroke} strokeWidth={2} pointerEvents="none" />
            </g>
          )
        })}
      </g>
    </svg>
  )
}
