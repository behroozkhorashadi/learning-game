import { useEffect, useState } from 'react'
import { listPublishedMaps, type PublishedMapRecord } from '../lib/pathfinderCustomMaps'
import type { Difficulty, DotPuzzle } from '../lib/pathfinderTypes'

/**
 * Every map any player has published, newest first. Finishing one records
 * it as a completion keyed by the map's id (same store as curated levels),
 * which is what puts the check mark on its card.
 *
 * The list is re-fetched every time this screen mounts (including coming
 * back from playing a map) and whenever the window regains focus, so a map
 * that gets unpublished simply disappears.
 */

const TIER_LABEL: Record<Difficulty, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard', legendary: 'Legendary' }

interface Props {
  profileId: number
  completedIds: Set<string>
  onPlay: (puzzle: DotPuzzle) => void
}

function PublishedMapCard({
  record,
  played,
  isMine,
  onPlay,
}: {
  record: PublishedMapRecord
  played: boolean
  isMine: boolean
  onPlay: () => void
}) {
  const { puzzle } = record
  const name = puzzle.name || 'Untitled'
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
        {TIER_LABEL[puzzle.difficulty] ?? puzzle.difficulty} · {puzzle.dots.length} dots
      </span>
    </button>
  )
}

export function PathfinderPublishedMaps({ profileId, completedIds, onPlay }: Props) {
  const [records, setRecords] = useState<PublishedMapRecord[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    function load() {
      listPublishedMaps()
        .then((loaded) => {
          if (cancelled) return
          setRecords(loaded)
          setError(null)
        })
        .catch(() => {
          if (!cancelled) setError("Couldn't load published maps — is the server running?")
        })
    }
    load()
    window.addEventListener('focus', load)
    return () => {
      cancelled = true
      window.removeEventListener('focus', load)
    }
  }, [])

  const playedCount = records?.filter((r) => completedIds.has(r.puzzle.id)).length ?? 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%' }}>
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 20, color: 'var(--fg-primary)' }}>Published Maps</div>

      {error && (
        <div role="alert" style={{ textAlign: 'center', fontSize: 14, fontWeight: 700, color: 'var(--fg-warning)' }}>
          {error}
        </div>
      )}

      {records === null && !error && (
        <div style={{ textAlign: 'center', padding: '32px 16px', fontSize: 14, fontWeight: 600, color: 'var(--fg-tertiary)' }}>Loading maps…</div>
      )}

      {records?.length === 0 && (
        <div style={{ textAlign: 'center', padding: '32px 16px', fontSize: 14, fontWeight: 600, color: 'var(--fg-tertiary)' }}>
          No published maps yet — build one and hit Publish in My Maps.
        </div>
      )}

      {records && records.length > 0 && (
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
                onPlay={() => onPlay(record.puzzle)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
