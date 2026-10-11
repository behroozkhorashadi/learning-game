import { useMemo, useState, type ComponentType, type ReactElement } from 'react'
import { DenButton } from '@app/den/den_button.pure.ui.tsx'
import { ArrowLeftIcon } from '@app/den/icons.pure.ui.tsx'
import type { PathfinderLevelSelectProps } from './pathfinder_level_select.effect.ui.tsx'
import { ALL_LEVELS } from './pathfinder_levels.pure.lib.ts'
import type { PathfinderMapBuilderProps } from './pathfinder_map_builder.effect.ui.tsx'
import { PathfinderPlayPanel } from './pathfinder_play_panel.pure.ui.tsx'
import { computeLevelStatuses } from './pathfinder_progress.pure.lib.ts'
import type { PathfinderPublishedMapsProps } from './pathfinder_published_maps.effect.ui.tsx'
import type { DotPuzzle, LevelProgressStore, ScheduleTimeout } from './pathfinder_state.pure.lib.ts'
import { useLevelProgress } from './use_level_progress.pure.hook.ts'
import { usePathfinderPlay } from './use_pathfinder_play.pure.hook.ts'

/**
 * Pathfinder: No Way Back — connect every dot on the board with one
 * continuous path, moving only left/right/up/down, never revisiting a dot.
 *
 * A pure logic puzzle with no adaptive server-driven items: the backend
 * module only exists so this shows up in `GamePicker`; every level, the
 * solver, and all game state live here.
 *
 * Levels are a single fixed, ordered list (`ALL_LEVELS`): completing one
 * unlocks the next (stored per profile on the server through the injected
 * `LevelProgressStore`). Move validation/undo/restart/completion is shared
 * with the map builder's play-test view via `usePathfinderPlay`.
 *
 * Published Maps lists other players' published custom maps. Finishing one
 * is recorded through the same completions store (keyed by the map's
 * `custom-<uuid>` id, which can't collide with a curated level id), which
 * is what marks it played.
 */

export const PATHFINDER_GAME_ID = 'pathfinder_no_way_back'

type Mode = 'select' | 'play' | 'build' | 'published'
/** Which list the map being played came from — decides where Back goes. */
type PlaySource = 'levels' | 'published'

export interface PathfinderProps {
  readonly profileId: number
  readonly profileName?: string
  readonly onBack: () => void
}

export interface PathfinderDeps {
  readonly progress: LevelProgressStore
  readonly scheduleTimeout: ScheduleTimeout
  readonly LevelSelect: ComponentType<PathfinderLevelSelectProps>
  readonly PublishedMaps: ComponentType<PathfinderPublishedMapsProps>
  readonly MapBuilder: ComponentType<PathfinderMapBuilderProps>
}

const FIRST_LEVEL: DotPuzzle = ALL_LEVELS[0] ?? { id: 'empty', difficulty: 'easy', rows: 1, columns: 1, dots: [] }

function BackButton({ onClick }: { readonly onClick: () => void }): ReactElement {
  return (
    <button
      type="button"
      aria-label="Back"
      title="Back"
      onClick={onClick}
      style={{
        width: 56,
        height: 56,
        borderRadius: 9999,
        border: '2px solid var(--border-default)',
        background: 'var(--surface-default)',
        color: 'var(--fg-secondary)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        flex: 'none',
      }}
    >
      <ArrowLeftIcon />
    </button>
  )
}

export function bindPathfinder({ progress, scheduleTimeout, LevelSelect, PublishedMaps, MapBuilder }: PathfinderDeps): ComponentType<PathfinderProps> {
  function Pathfinder({ profileId, profileName, onBack }: PathfinderProps): ReactElement {
    const [mode, setMode] = useState<Mode>('select')
    const [puzzle, setPuzzle] = useState<DotPuzzle>(FIRST_LEVEL)
    const [playSource, setPlaySource] = useState<PlaySource>('levels')
    const levels = useLevelProgress(progress, profileId)

    const statuses = useMemo(() => computeLevelStatuses(ALL_LEVELS, levels.completedIds), [levels.completedIds])
    const currentIndex = ALL_LEVELS.findIndex((p) => p.id === puzzle.id)
    const nextLevel = playSource === 'levels' && currentIndex >= 0 ? ALL_LEVELS[currentIndex + 1] : undefined

    const play = usePathfinderPlay(puzzle, scheduleTimeout, () => {
      levels.recordCompletion(puzzle.id)
    })

    function playLevel(levelId: string): void {
      const level = ALL_LEVELS.find((p) => p.id === levelId)
      if (level === undefined) return
      setPuzzle(level)
      setPlaySource('levels')
      setMode('play')
    }

    function playPublishedMap(map: DotPuzzle): void {
      setPuzzle(map)
      setPlaySource('published')
      setMode('play')
    }

    function handleBackToList(): void {
      setMode(playSource === 'published' ? 'published' : 'select')
    }

    function handleTopBack(): void {
      if (mode === 'play') handleBackToList()
      else if (mode === 'build' || mode === 'published') setMode('select')
      else onBack()
    }

    const completeMessage = playSource === 'published' || nextLevel !== undefined ? 'Every dot connected! 🎉' : "Every dot connected! You've finished every map! 🎉"

    return (
      <div style={{ minHeight: '100%', boxSizing: 'border-box', background: 'var(--surface-app)', display: 'flex', justifyContent: 'center', padding: '32px 24px 56px' }}>
        <div style={{ width: '100%', maxWidth: 760, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <BackButton onClick={handleTopBack} />
            <h1 style={{ margin: 0, fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22, color: 'var(--fg-primary)' }}>Pathfinder: No Way Back</h1>
          </div>

          {(mode === 'select' || mode === 'published') && levels.saveFailed && (
            <div role="alert" style={{ fontSize: 14, fontWeight: 700, color: 'var(--fg-warning)', textAlign: 'center' }}>
              Couldn&apos;t save your progress — is the server running?
            </div>
          )}

          {mode === 'select' && levels.status === 'loading' && <div style={{ textAlign: 'center', padding: 32, fontSize: 14, fontWeight: 600, color: 'var(--fg-tertiary)' }}>Loading maps…</div>}

          {mode === 'select' && levels.status === 'error' && (
            <div role="alert" style={{ textAlign: 'center', padding: 32, fontSize: 14, fontWeight: 700, color: 'var(--fg-warning)' }}>
              Couldn&apos;t load your progress — is the server running?
            </div>
          )}

          {mode === 'select' && levels.status === 'ready' && (
            <LevelSelect
              profileId={profileId}
              statuses={statuses}
              onSelect={playLevel}
              onBuild={() => {
                setMode('build')
              }}
              onBrowsePublished={() => {
                setMode('published')
              }}
            />
          )}

          {mode === 'published' && <PublishedMaps profileId={profileId} completedIds={levels.completedIds} onPlay={playPublishedMap} />}

          {mode === 'build' && <MapBuilder profileId={profileId} username={profileName === undefined || profileName === '' ? 'Player' : profileName} />}

          {mode === 'play' && (
            <div
              style={{
                background: 'var(--surface-default)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 24,
                padding: '28px 24px',
                boxShadow: 'var(--elevation-300)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 20,
              }}
            >
              <PathfinderPlayPanel
                puzzle={puzzle}
                title={puzzle.name ?? 'Connect every dot'}
                play={play}
                completeMessage={completeMessage}
                actions={
                  <>
                    {play.completed && nextLevel !== undefined && (
                      <DenButton
                        label="Next Level"
                        variant="primary"
                        onClick={() => {
                          playLevel(nextLevel.id)
                        }}
                      />
                    )}
                    {play.completed && <DenButton label={playSource === 'published' ? 'Back to Published Maps' : 'Back to Map'} variant="quiet" onClick={handleBackToList} />}
                  </>
                }
              />
            </div>
          )}
        </div>
      </div>
    )
  }
  return Pathfinder
}
