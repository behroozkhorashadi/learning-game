import type { LevelStatus } from '../lib/pathfinderProgress'
import type { Difficulty } from '../lib/pathfinderTypes'

/**
 * The map: every level in fixed order, grouped by difficulty tier, each
 * shown as locked / unlocked / completed. Locked cards aren't clickable —
 * "some maps need to be unlocked by playing the previous maps" (finishing
 * level N unlocks level N+1, computed by `pathfinderProgress`).
 */

const SECTION_LABEL: Record<Difficulty, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
  legendary: 'Legendary',
}

interface Props {
  statuses: LevelStatus[]
  onSelect: (levelId: string) => void
}

function groupByDifficulty(statuses: LevelStatus[]): { difficulty: Difficulty; items: LevelStatus[] }[] {
  const groups: { difficulty: Difficulty; items: LevelStatus[] }[] = []
  for (const status of statuses) {
    const last = groups[groups.length - 1]
    if (last && last.difficulty === status.puzzle.difficulty) last.items.push(status)
    else groups.push({ difficulty: status.puzzle.difficulty, items: [status] })
  }
  return groups
}

function LevelCard({ status, onSelect }: { status: LevelStatus; onSelect: (levelId: string) => void }) {
  const { puzzle, unlocked, completed } = status
  return (
    <button
      type="button"
      disabled={!unlocked}
      onClick={() => unlocked && onSelect(puzzle.id)}
      aria-label={`${puzzle.name ?? puzzle.id}${completed ? ', completed' : unlocked ? '' : ', locked'}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        padding: '16px 14px',
        borderRadius: 18,
        border: `2px solid ${completed ? 'var(--status-positive-border)' : 'var(--border-default)'}`,
        background: completed ? 'var(--status-positive-bg)' : unlocked ? 'var(--surface-default)' : 'var(--gray-100)',
        cursor: unlocked ? 'pointer' : 'default',
        opacity: unlocked ? 1 : 0.6,
        minWidth: 120,
      }}
    >
      <span style={{ fontSize: 26 }}>{completed ? '✅' : unlocked ? '🔗' : '🔒'}</span>
      <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--fg-primary)', textAlign: 'center' }}>
        {puzzle.name ?? puzzle.id}
      </span>
      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-tertiary)' }}>{puzzle.dots.length} dots</span>
    </button>
  )
}

export function PathfinderLevelSelect({ statuses, onSelect }: Props) {
  const groups = groupByDifficulty(statuses)
  const completedCount = statuses.filter((s) => s.completed).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, width: '100%' }}>
      <div style={{ textAlign: 'center', fontSize: 13, fontWeight: 700, color: 'var(--fg-tertiary)' }}>
        {completedCount} / {statuses.length} maps completed
      </div>
      {groups.map((group) => (
        <div key={group.difficulty} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              letterSpacing: '.08em',
              textTransform: 'uppercase',
              fontWeight: 700,
              color: 'var(--fg-tertiary)',
            }}
          >
            {SECTION_LABEL[group.difficulty]}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 12 }}>
            {group.items.map((status) => (
              <LevelCard key={status.puzzle.id} status={status} onSelect={onSelect} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
