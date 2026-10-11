import { useState, type ComponentType, type ReactElement } from 'react'
import { assessDifficulty } from './pathfinder_difficulty.pure.lib.ts'
import { ALL_LEVELS } from './pathfinder_levels.pure.lib.ts'
import type { PathfinderPlayTestProps } from './pathfinder_playtest.effect.ui.tsx'
import type { Difficulty, DotPuzzle } from './pathfinder_state.pure.lib.ts'

/**
 * Dev-only QA tool: every curated level, every tier fully unlocked, with the
 * assessed score shown right on the card — so a real playthrough can be
 * checked against what the difficulty engine claims, and any level that
 * plays easier than its tier suggests is easy to spot. Reuses the builder's
 * play-test screen rather than the real game's level-select/progress
 * machinery, since unlocking is exactly the thing this tool exists to bypass.
 */

const TIER_LABEL: Readonly<Record<Difficulty, string>> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
  legendary: 'Legendary',
}

export interface PathfinderLevelGalleryDeps {
  readonly PlayTest: ComponentType<PathfinderPlayTestProps>
}

function groupByDifficulty(levels: readonly DotPuzzle[]): readonly { readonly difficulty: Difficulty; readonly items: readonly DotPuzzle[] }[] {
  const groups: { difficulty: Difficulty; items: DotPuzzle[] }[] = []
  for (const puzzle of levels) {
    const last = groups.at(-1)
    if (last?.difficulty === puzzle.difficulty) last.items.push(puzzle)
    else groups.push({ difficulty: puzzle.difficulty, items: [puzzle] })
  }
  return groups
}

// `assessDifficulty` runs the full solver (~80ms a level), and curated
// levels never change — so score each one once per page load rather than on
// every render of every card.
const assessmentCache = new Map<DotPuzzle, ReturnType<typeof assessDifficulty>>()

function assessOnce(puzzle: DotPuzzle): ReturnType<typeof assessDifficulty> {
  const cached = assessmentCache.get(puzzle)
  if (cached !== undefined) return cached
  const assessment = assessDifficulty(puzzle)
  assessmentCache.set(puzzle, assessment)
  return assessment
}

function LevelCard({ puzzle, onSelect }: { readonly puzzle: DotPuzzle; readonly onSelect: () => void }): ReactElement {
  const assessment = assessOnce(puzzle)
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={puzzle.name ?? puzzle.id}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '16px 14px', borderRadius: 18, border: '2px solid var(--border-default)', background: 'var(--surface-default)', cursor: 'pointer', minWidth: 120 }}
    >
      <span style={{ fontSize: 26 }}>🔗</span>
      <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--fg-primary)', textAlign: 'center' }}>{puzzle.name ?? puzzle.id}</span>
      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-tertiary)' }}>{puzzle.dots.length} dots</span>
      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-brand)' }}>score {assessment.score ?? '?'}</span>
    </button>
  )
}

export function bindPathfinderLevelGallery({ PlayTest }: PathfinderLevelGalleryDeps): ComponentType {
  function PathfinderLevelGallery(): ReactElement {
    const [selected, setSelected] = useState<DotPuzzle | null>(null)

    if (selected !== null) {
      return (
        <PlayTest
          puzzle={selected}
          onBack={() => {
            setSelected(null)
          }}
          backLabel="Back to All Levels"
        />
      )
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24, width: '100%' }}>
        <div style={{ textAlign: 'center', fontSize: 13, fontWeight: 700, color: 'var(--fg-tertiary)' }}>Dev QA — every level unlocked ({ALL_LEVELS.length} total)</div>
        {groupByDifficulty(ALL_LEVELS).map((group) => (
          <section key={group.difficulty} aria-label={`${TIER_LABEL[group.difficulty]} levels`} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', fontWeight: 700, color: 'var(--fg-tertiary)' }}>{TIER_LABEL[group.difficulty]}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 12 }}>
              {group.items.map((puzzle) => (
                <LevelCard
                  key={puzzle.id}
                  puzzle={puzzle}
                  onSelect={() => {
                    setSelected(puzzle)
                  }}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    )
  }
  return PathfinderLevelGallery
}
