import type { ComponentType, ReactElement } from 'react'
import type { Difficulty, DotPuzzle, ListPublishedMaps, PublishedMapRecord, SubscribeToFocus } from './pathfinder_state.pure.lib.ts'
import { usePublishedMaps } from './use_published_maps.pure.hook.ts'

/**
 * Every map any player has published, newest first. Finishing one records
 * it as a completion keyed by the map's id (same store as curated levels),
 * which is what puts the check mark on its card.
 *
 * The list is re-read every time this screen mounts (including coming back
 * from playing a map) and whenever the window regains focus, so a map that
 * gets unpublished simply disappears.
 */

const TIER_LABEL: Readonly<Record<Difficulty, string>> = { easy: 'Easy', medium: 'Medium', hard: 'Hard', legendary: 'Legendary' }

export interface PathfinderPublishedMapsProps {
  readonly profileId: number
  readonly completedIds: ReadonlySet<string>
  readonly onPlay: (puzzle: DotPuzzle) => void
}

export interface PathfinderPublishedMapsDeps {
  readonly listPublishedMaps: ListPublishedMaps
  readonly subscribeToFocus: SubscribeToFocus
}

function PublishedMapCard({ record, played, isMine, onPlay }: { readonly record: PublishedMapRecord; readonly played: boolean; readonly isMine: boolean; readonly onPlay: () => void }): ReactElement {
  const { puzzle } = record
  const name = puzzle.name === undefined || puzzle.name === '' ? 'Untitled' : puzzle.name
  return (
    <button
      type="button"
      onClick={onPlay}
      aria-label={`${name}${played ? ', played' : ''}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        padding: '16px 14px',
        borderRadius: 18,
        border: `2px solid ${played ? 'var(--status-positive-border)' : 'var(--border-default)'}`,
        background: played ? 'var(--status-positive-bg)' : 'var(--surface-default)',
        cursor: 'pointer',
        minWidth: 140,
      }}
    >
      <span style={{ fontSize: 26 }}>{played ? '✅' : '🗺️'}</span>
      <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--fg-primary)', textAlign: 'center' }}>{name}</span>
      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg-secondary)' }}>by {isMine ? 'you' : record.authorName}</span>
      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-tertiary)' }}>
        {TIER_LABEL[puzzle.difficulty]} · {puzzle.dots.length} dots
      </span>
    </button>
  )
}

export function bindPathfinderPublishedMaps({ listPublishedMaps, subscribeToFocus }: PathfinderPublishedMapsDeps): ComponentType<PathfinderPublishedMapsProps> {
  function PathfinderPublishedMaps({ profileId, completedIds, onPlay }: PathfinderPublishedMapsProps): ReactElement {
    const { records, failed } = usePublishedMaps(listPublishedMaps, subscribeToFocus)
    const playedCount = records?.filter((r) => completedIds.has(r.puzzle.id)).length ?? 0

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%' }}>
        <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 20, color: 'var(--fg-primary)' }}>Published Maps</h2>

        {failed && (
          <div role="alert" style={{ textAlign: 'center', fontSize: 14, fontWeight: 700, color: 'var(--fg-warning)' }}>
            Couldn&apos;t load published maps — is the server running?
          </div>
        )}

        {records === null && !failed && <div style={{ textAlign: 'center', padding: '32px 16px', fontSize: 14, fontWeight: 600, color: 'var(--fg-tertiary)' }}>Loading maps…</div>}

        {records?.length === 0 && (
          <div style={{ textAlign: 'center', padding: '32px 16px', fontSize: 14, fontWeight: 600, color: 'var(--fg-tertiary)' }}>No published maps yet — build one and hit Publish in My Maps.</div>
        )}

        {records !== null && records.length > 0 && (
          <>
            <div style={{ textAlign: 'center', fontSize: 13, fontWeight: 700, color: 'var(--fg-tertiary)' }}>
              {playedCount} / {records.length} maps played
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 }}>
              {records.map((record) => (
                <PublishedMapCard
                  key={record.puzzle.id}
                  record={record}
                  played={completedIds.has(record.puzzle.id)}
                  isMine={record.authorProfileId === profileId}
                  onPlay={() => {
                    onPlay(record.puzzle)
                  }}
                />
              ))}
            </div>
          </>
        )}
      </div>
    )
  }
  return PathfinderPublishedMaps
}
