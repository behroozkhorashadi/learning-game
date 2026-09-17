import { useRef, useState } from 'react'
import { DenButton } from './den/DenButton'
import { formatLevelCode } from '../lib/pathfinderExport'
import { deleteCustomMap, listCustomMaps, renameCustomMap, setCustomMapPublished, type CustomMapRecord } from '../lib/pathfinderCustomMaps'
import type { Difficulty, DotPuzzle } from '../lib/pathfinderTypes'

/**
 * The builder's personal map library: every map this browser has saved,
 * most recently created first, with rename/delete/publish and — since
 * there's still no backend endpoint for actually sharing a map with other
 * players — a "Publish" toggle that's a local-only flag for now (see
 * pathfinderCustomMaps.ts's file header) plus an Export Code action so a
 * map can still be handed off by hand into the curated level set, the same
 * way the builder originally worked before it grew a save/manage flow.
 */

const TIER_LABEL: Record<Difficulty, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard', legendary: 'Legendary' }
const TIER_COLOR: Record<Difficulty, { bg: string; text: string; border: string }> = {
  easy: { bg: 'var(--green-200)', text: 'var(--green-900)', border: 'var(--green-400)' },
  medium: { bg: 'var(--blue-200)', text: 'var(--blue-900)', border: 'var(--blue-400)' },
  hard: { bg: 'var(--orange-200)', text: 'var(--orange-900)', border: 'var(--orange-600)' },
  legendary: { bg: 'var(--purple-200)', text: 'var(--purple-800)', border: 'var(--purple-600)' },
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

interface Props {
  onBack: () => void
  onPlay: (puzzle: DotPuzzle) => void
}

function MapRow({
  record,
  onPlay,
  onDelete,
  onRename,
  onTogglePublish,
  exportOpen,
  onToggleExport,
}: {
  record: CustomMapRecord
  onPlay: () => void
  onDelete: () => void
  onRename: () => void
  onTogglePublish: () => void
  exportOpen: boolean
  onToggleExport: () => void
}) {
  const exportRef = useRef<HTMLTextAreaElement>(null)
  const tier = TIER_COLOR[record.puzzle.difficulty]

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        padding: '14px 16px',
        borderRadius: 16,
        border: '1px solid var(--border-default)',
        background: 'var(--surface-default)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--fg-primary)' }}>{record.puzzle.name || 'Untitled'}</span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              padding: '3px 9px',
              borderRadius: 9999,
              background: tier.bg,
              color: tier.text,
              border: `1px solid ${tier.border}`,
            }}
          >
            {TIER_LABEL[record.puzzle.difficulty]}
          </span>
          {record.published && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: '3px 9px',
                borderRadius: 9999,
                background: 'var(--status-positive-bg)',
                color: 'var(--green-900)',
                border: '1px solid var(--status-positive-border)',
              }}
            >
              Published
            </span>
          )}
        </div>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-tertiary)' }}>
          {record.puzzle.dots.length} dots · {formatDate(record.createdAt)}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <DenButton label="Play" size="sm" variant="primary" onClick={onPlay} />
        <DenButton label="Rename" size="sm" variant="quiet" onClick={onRename} />
        <DenButton label={record.published ? 'Unpublish' : 'Publish'} size="sm" variant="quiet" onClick={onTogglePublish} />
        <DenButton label={exportOpen ? 'Hide Code' : 'Export Code'} size="sm" variant="quiet" onClick={onToggleExport} />
        <DenButton label="Delete" size="sm" variant="ghost" onClick={onDelete} />
      </div>

      {exportOpen && (
        <textarea
          ref={exportRef}
          readOnly
          aria-label={`Exported level code for ${record.puzzle.name || 'Untitled'}`}
          onFocus={() => exportRef.current?.select()}
          value={formatLevelCode(record.puzzle)}
          rows={Math.min(record.puzzle.dots.length + 6, 16)}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            padding: 10,
            borderRadius: 10,
            border: '1px solid var(--border-default)',
            background: 'var(--gray-100)',
            resize: 'vertical',
          }}
        />
      )}
    </div>
  )
}

export function PathfinderMyMaps({ onBack, onPlay }: Props) {
  const [records, setRecords] = useState<CustomMapRecord[]>(() => listCustomMaps())
  const [exportOpenId, setExportOpenId] = useState<string | null>(null)

  function refresh() {
    setRecords(listCustomMaps())
  }

  function handleDelete(id: string, name: string) {
    if (!window.confirm(`Delete "${name || 'Untitled'}"? This can't be undone.`)) return
    deleteCustomMap(id)
    if (exportOpenId === id) setExportOpenId(null)
    refresh()
  }

  function handleRename(id: string, currentName: string) {
    const next = window.prompt('Rename map:', currentName)
    if (next === null) return
    const trimmed = next.trim()
    if (!trimmed || trimmed === currentName) return
    renameCustomMap(id, trimmed)
    refresh()
  }

  function handleTogglePublish(id: string, published: boolean) {
    setCustomMapPublished(id, !published)
    refresh()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%', maxWidth: 640, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 20, color: 'var(--fg-primary)' }}>My Maps</div>
        <DenButton label="Back to Builder" variant="quiet" onClick={onBack} />
      </div>

      {records.length === 0 && (
        <div style={{ textAlign: 'center', padding: '32px 16px', fontSize: 14, fontWeight: 600, color: 'var(--fg-tertiary)' }}>
          No saved maps yet — build one and hit Save.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {records.map((record) => (
          <MapRow
            key={record.puzzle.id}
            record={record}
            onPlay={() => onPlay(record.puzzle)}
            onDelete={() => handleDelete(record.puzzle.id, record.puzzle.name ?? '')}
            onRename={() => handleRename(record.puzzle.id, record.puzzle.name ?? '')}
            onTogglePublish={() => handleTogglePublish(record.puzzle.id, record.published)}
            exportOpen={exportOpenId === record.puzzle.id}
            onToggleExport={() => setExportOpenId((prev) => (prev === record.puzzle.id ? null : record.puzzle.id))}
          />
        ))}
      </div>
    </div>
  )
}
