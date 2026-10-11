import { useCallback, type ComponentType, type ReactElement } from 'react'
import { ArrowRightIcon } from '@app/den/icons.pure.ui.tsx'
import { useQuery } from '@app/query/use_query.pure.hook.ts'
import type { LevelStatus } from './pathfinder_progress.pure.lib.ts'
import type { Difficulty, MapLibrary } from './pathfinder_state.pure.lib.ts'

/**
 * The map: "Build Your Own Map" and "Published Maps" entry points followed
 * by every curated level in fixed order, grouped by difficulty tier, each
 * shown as locked / unlocked / completed. Locked cards aren't clickable —
 * finishing level N unlocks level N+1 (pathfinder_progress.pure.lib.ts).
 * The build card's subtitle counts the profile's saved maps.
 */

const SECTION_LABEL: Readonly<Record<Difficulty, string>> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
  legendary: 'Legendary',
}

export interface PathfinderLevelSelectProps {
  readonly profileId: number
  readonly statuses: readonly LevelStatus[]
  readonly onSelect: (levelId: string) => void
  readonly onBuild: () => void
  readonly onBrowsePublished: () => void
}

export interface PathfinderLevelSelectDeps {
  readonly listMaps: MapLibrary['listMaps']
}

function groupByDifficulty(statuses: readonly LevelStatus[]): readonly { readonly difficulty: Difficulty; readonly items: readonly LevelStatus[] }[] {
  const groups: { difficulty: Difficulty; items: LevelStatus[] }[] = []
  for (const status of statuses) {
    const last = groups.at(-1)
    if (last?.difficulty === status.puzzle.difficulty) last.items.push(status)
    else groups.push({ difficulty: status.puzzle.difficulty, items: [status] })
  }
  return groups
}

function LevelCard({ status, onSelect }: { readonly status: LevelStatus; readonly onSelect: (levelId: string) => void }): ReactElement {
  const { puzzle, unlocked, completed } = status
  const name = puzzle.name ?? puzzle.id
  return (
    <button
      type="button"
      disabled={!unlocked}
      onClick={() => {
        onSelect(puzzle.id)
      }}
      aria-label={`${name}${completed ? ', completed' : unlocked ? '' : ', locked'}`}
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
      <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--fg-primary)', textAlign: 'center' }}>{name}</span>
      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-tertiary)' }}>{puzzle.dots.length} dots</span>
    </button>
  )
}

function EntryCard({ icon, title, subtitle, onClick }: { readonly icon: string; readonly title: string; readonly subtitle: string; readonly onClick: () => void }): ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        background: 'var(--surface-default)',
        border: '1.5px solid var(--border-default)',
        borderRadius: 22,
        padding: '18px 20px',
        cursor: 'pointer',
        textAlign: 'left',
        boxShadow: 'var(--elevation-300)',
      }}
    >
      <span style={{ fontSize: 34, flex: 'none' }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18, color: 'var(--fg-primary)' }}>{title}</div>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--fg-tertiary)', marginTop: 3 }}>{subtitle}</div>
      </div>
      <div style={{ color: 'var(--fg-tertiary)', flex: 'none' }}>
        <ArrowRightIcon size={22} />
      </div>
    </button>
  )
}

/** "3 maps you've built", or the pitch when there are none (or the count couldn't load: the card still works without it). */
function buildSubtitle(savedCount: number): string {
  if (savedCount === 0) return 'Design a puzzle, check it, and play it'
  return `${String(savedCount)} map${savedCount === 1 ? '' : 's'} you've built`
}

export function bindPathfinderLevelSelect({ listMaps }: PathfinderLevelSelectDeps): ComponentType<PathfinderLevelSelectProps> {
  function PathfinderLevelSelect({ profileId, statuses, onSelect, onBuild, onBrowsePublished }: PathfinderLevelSelectProps): ReactElement {
    const loadSaved = useCallback(() => listMaps(profileId), [profileId])
    const saved = useQuery(loadSaved)
    const groups = groupByDifficulty(statuses)
    const completedCount = statuses.filter((s) => s.completed).length

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24, width: '100%' }}>
        <EntryCard icon="🛠️" title="Build Your Own Map" subtitle={buildSubtitle(saved.kind === 'loaded' ? saved.data.length : 0)} onClick={onBuild} />
        <EntryCard icon="🌍" title="Published Maps" subtitle="Play maps other players have shared" onClick={onBrowsePublished} />

        <div style={{ textAlign: 'center', fontSize: 13, fontWeight: 700, color: 'var(--fg-tertiary)' }}>
          {completedCount} / {statuses.length} maps completed
        </div>
        {groups.map((group) => (
          <section key={group.difficulty} aria-label={`${SECTION_LABEL[group.difficulty]} maps`} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', fontWeight: 700, color: 'var(--fg-tertiary)' }}>{SECTION_LABEL[group.difficulty]}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 12 }}>
              {group.items.map((status) => (
                <LevelCard key={status.puzzle.id} status={status} onSelect={onSelect} />
              ))}
            </div>
          </section>
        ))}
      </div>
    )
  }
  return PathfinderLevelSelect
}
