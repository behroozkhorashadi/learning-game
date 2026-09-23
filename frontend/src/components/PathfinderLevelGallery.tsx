import { useState } from 'react'
import { PathfinderPlayTest } from './PathfinderPlayTest'
import { assessDifficulty } from '../lib/pathfinderDifficulty'
import { ALL_LEVELS } from '../lib/pathfinderLevels'
import type { Difficulty, DotPuzzle } from '../lib/pathfinderTypes'

/**
 * Dev-only QA tool: every curated level, every tier fully unlocked,
 * with the assessed score shown right on the card — so a real playthrough
 * can be checked against what the difficulty engine claims, and any level
 * that plays easier than its tier suggests is easy to spot. Reuses
 * `PathfinderPlayTest` (built for the map builder's "try it" flow) rather
 * than the real game's level-select/progress machinery, since unlocking is
 * exactly the thing this tool exists to bypass.
 */

const TIER_LABEL: Record<Difficulty, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
  legendary: 'Legendary',
}

function groupByDifficulty(levels: DotPuzzle[]): { difficulty: Difficulty; items: DotPuzzle[] }[] {
  const groups: { difficulty: Difficulty; items: DotPuzzle[] }[] = []
  for (const puzzle of levels) {
    const last = groups[groups.length - 1]
    if (last && last.difficulty === puzzle.difficulty) last.items.push(puzzle)
    else groups.push({ difficulty: puzzle.difficulty, items: [puzzle] })
  }
  return groups
}

function LevelCard({ puzzle, onSelect }: { puzzle: DotPuzzle; onSelect: () => void }) {
  const assessment = assessDifficulty(puzzle)
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={puzzle.name ?? puzzle.id}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        padding: '16px 14px',
        borderRadius: 18,
        border: '2px solid var(--border-default)',
        background: 'var(--surface-default)',
        cursor: 'pointer',
        minWidth: 120,
      }}
    >
      <span style={{ fontSize: 26 }}>🔗</span>
      <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--fg-primary)', textAlign: 'center' }}>
        {puzzle.name ?? puzzle.id}
      </span>
      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-tertiary)' }}>{puzzle.dots.length} dots</span>
      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-brand)' }}>score {assessment.score ?? '?'}</span>
    </button>
  )
}

export function PathfinderLevelGallery() {
  const [selected, setSelected] = useState<DotPuzzle | null>(null)
  const groups = groupByDifficulty(ALL_LEVELS)

  if (selected) {
    return <PathfinderPlayTest puzzle={selected} onBack={() => setSelected(null)} backLabel="Back to All Levels" />
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, width: '100%' }}>
      <div style={{ textAlign: 'center', fontSize: 13, fontWeight: 700, color: 'var(--fg-tertiary)' }}>
        Dev QA — every level unlocked ({ALL_LEVELS.length} total)
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
            {TIER_LABEL[group.difficulty]}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 12 }}>
            {group.items.map((puzzle) => (
              <LevelCard key={puzzle.id} puzzle={puzzle} onSelect={() => setSelected(puzzle)} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
