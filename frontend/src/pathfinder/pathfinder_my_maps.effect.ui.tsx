import { useCallback, useState, type ComponentType, type ReactElement } from 'react'
import { DenButton } from '@app/den/den_button.pure.ui.tsx'
import { useReloadableQuery } from '@app/query/use_reloadable_query.pure.hook.ts'
import { formatLevelCode } from './pathfinder_export.pure.lib.ts'
import type { CustomMapRecord, Dialogs, Difficulty, DotPuzzle, MapLibrary } from './pathfinder_state.pure.lib.ts'

/**
 * The builder's personal map library: every map this profile has saved,
 * most recently created first, with rename/delete, a Publish toggle (a
 * published map shows up for every player on the Published Maps screen;
 * unpublishing takes it back off), plus an Export Code action so a map can
 * still be handed off by hand into the curated level set.
 *
 * Every change goes to the server first, then the list is re-read, so the
 * page always shows what's actually saved.
 */

const TIER_LABEL: Readonly<Record<Difficulty, string>> = { easy: 'Easy', medium: 'Medium', hard: 'Hard', legendary: 'Legendary' }
const TIER_COLOR: Readonly<Record<Difficulty, { readonly bg: string; readonly text: string; readonly border: string }>> = {
  easy: { bg: 'var(--green-200)', text: 'var(--green-900)', border: 'var(--green-400)' },
  medium: { bg: 'var(--blue-200)', text: 'var(--blue-900)', border: 'var(--blue-400)' },
  hard: { bg: 'var(--orange-200)', text: 'var(--orange-900)', border: 'var(--orange-600)' },
  legendary: { bg: 'var(--purple-200)', text: 'var(--purple-800)', border: 'var(--purple-600)' },
}

const LOAD_FAILED = "Couldn't load your maps — is the server running?"

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

const displayName = (puzzle: DotPuzzle): string => (puzzle.name === undefined || puzzle.name === '' ? 'Untitled' : puzzle.name)

export interface PathfinderMyMapsProps {
  readonly profileId: number
  readonly onBack: () => void
  readonly onPlay: (puzzle: DotPuzzle) => void
}

export interface PathfinderMyMapsDeps {
  readonly maps: Omit<MapLibrary, 'saveMap'>
  readonly dialogs: Dialogs
}

interface MapRowProps {
  readonly record: CustomMapRecord
  readonly onPlay: () => void
  readonly onDelete: () => void
  readonly onRename: () => void
  readonly onTogglePublish: () => void
  readonly exportOpen: boolean
  readonly onToggleExport: () => void
}

function MapRow({ record, onPlay, onDelete, onRename, onTogglePublish, exportOpen, onToggleExport }: MapRowProps): ReactElement {
  const tier = TIER_COLOR[record.puzzle.difficulty]
  const name = displayName(record.puzzle)

  return (
    <li style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10, padding: '14px 16px', borderRadius: 16, border: '1px solid var(--border-default)', background: 'var(--surface-default)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--fg-primary)' }}>{name}</span>
          <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 9999, background: tier.bg, color: tier.text, border: `1px solid ${tier.border}` }}>
            {TIER_LABEL[record.puzzle.difficulty]}
          </span>
          {record.published && (
            <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 9999, background: 'var(--status-positive-bg)', color: 'var(--green-900)', border: '1px solid var(--status-positive-border)' }}>Published</span>
          )}
        </div>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-tertiary)' }}>
          {record.puzzle.dots.length} dots · {formatDate(record.createdAt)}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <DenButton label="Play" ariaLabel={`Play ${name}`} size="sm" variant="primary" onClick={onPlay} />
        <DenButton label="Rename" ariaLabel={`Rename ${name}`} size="sm" variant="quiet" onClick={onRename} />
        <DenButton label={record.published ? 'Unpublish' : 'Publish'} ariaLabel={`${record.published ? 'Unpublish' : 'Publish'} ${name}`} size="sm" variant="quiet" onClick={onTogglePublish} />
        <DenButton label={exportOpen ? 'Hide Code' : 'Export Code'} ariaLabel={`${exportOpen ? 'Hide code for' : 'Export code for'} ${name}`} size="sm" variant="quiet" onClick={onToggleExport} />
        <DenButton label="Delete" ariaLabel={`Delete ${name}`} size="sm" variant="ghost" onClick={onDelete} />
      </div>

      {exportOpen && (
        <textarea
          readOnly
          aria-label={`Exported level code for ${name}`}
          onFocus={(e) => {
            e.currentTarget.select()
          }}
          value={formatLevelCode(record.puzzle)}
          rows={Math.min(record.puzzle.dots.length + 6, 16)}
          style={{ width: '100%', boxSizing: 'border-box', fontFamily: 'var(--font-mono)', fontSize: 12, padding: 10, borderRadius: 10, border: '1px solid var(--border-default)', background: 'var(--gray-100)', resize: 'vertical' }}
        />
      )}
    </li>
  )
}

export function bindPathfinderMyMaps({ maps, dialogs }: PathfinderMyMapsDeps): ComponentType<PathfinderMyMapsProps> {
  function PathfinderMyMaps({ profileId, onBack, onPlay }: PathfinderMyMapsProps): ReactElement {
    const load = useCallback(() => maps.listMaps(profileId), [profileId])
    const { state, reload } = useReloadableQuery(load)
    const [changeError, setChangeError] = useState<string | null>(null)
    const [exportOpenId, setExportOpenId] = useState<string | null>(null)

    async function apply(change: () => Promise<void>, failure: string): Promise<void> {
      try {
        await change()
        setChangeError(null)
        reload()
      } catch {
        setChangeError(failure)
      }
    }

    function handleDelete(record: CustomMapRecord): void {
      if (!dialogs.confirm(`Delete "${displayName(record.puzzle)}"? This can't be undone.`)) return
      if (exportOpenId === record.puzzle.id) setExportOpenId(null)
      void apply(() => maps.deleteMap(profileId, record.puzzle.id), "Couldn't delete that map.")
    }

    function handleRename(record: CustomMapRecord): void {
      const currentName = record.puzzle.name ?? ''
      const next = dialogs.prompt('Rename map:', currentName)
      if (next === null) return
      const trimmed = next.trim()
      if (trimmed === '' || trimmed === currentName) return
      void apply(() => maps.renameMap(profileId, record.puzzle.id, trimmed), "Couldn't rename that map.")
    }

    function handleTogglePublish(record: CustomMapRecord): void {
      void apply(() => maps.setMapPublished(profileId, record.puzzle.id, !record.published), "Couldn't change that map's published setting.")
    }

    const error = changeError ?? (state.kind === 'failed' ? LOAD_FAILED : null)
    const records = state.kind === 'loaded' ? state.data : null

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%', maxWidth: 640, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 20, color: 'var(--fg-primary)' }}>My Maps</h2>
          <DenButton label="Back to Builder" variant="quiet" onClick={onBack} />
        </div>

        {error !== null && (
          <div role="alert" style={{ textAlign: 'center', fontSize: 14, fontWeight: 700, color: 'var(--fg-warning)' }}>
            {error}
          </div>
        )}

        {state.kind === 'loading' && <div style={{ textAlign: 'center', padding: '32px 16px', fontSize: 14, fontWeight: 600, color: 'var(--fg-tertiary)' }}>Loading maps…</div>}

        {records?.length === 0 && (
          <div style={{ textAlign: 'center', padding: '32px 16px', fontSize: 14, fontWeight: 600, color: 'var(--fg-tertiary)' }}>No saved maps yet — build one and hit Save.</div>
        )}

        <ul aria-label="Saved maps" style={{ display: 'flex', flexDirection: 'column', gap: 10, margin: 0, padding: 0 }}>
          {records?.map((record) => (
            <MapRow
              key={record.puzzle.id}
              record={record}
              onPlay={() => {
                onPlay(record.puzzle)
              }}
              onDelete={() => {
                handleDelete(record)
              }}
              onRename={() => {
                handleRename(record)
              }}
              onTogglePublish={() => {
                handleTogglePublish(record)
              }}
              exportOpen={exportOpenId === record.puzzle.id}
              onToggleExport={() => {
                setExportOpenId((prev) => (prev === record.puzzle.id ? null : record.puzzle.id))
              }}
            />
          ))}
        </ul>
      </div>
    )
  }
  return PathfinderMyMaps
}
