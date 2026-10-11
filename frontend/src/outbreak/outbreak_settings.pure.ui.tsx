import type { ReactElement } from 'react'
import { DenButton } from '@app/den/den_button.pure.ui.tsx'
import { FOCUS_NUMBER_OPTIONS, MAX_DIFFICULTY, MIN_DIFFICULTY, OPERATIONS, difficultyLabel, toggleFocusNumber, toggleOperation, type SettingsDraft } from './outbreak_settings_form.pure.lib.ts'

/**
 * Equation Outbreak's practice settings form, props only: a parent picks the
 * operations, the focus numbers per operation, and a pinned difficulty, or
 * leaves it automatic. Reached from the gear on the game's picker tile.
 */

export interface OutbreakSettingsViewProps {
  readonly draft: SettingsDraft
  readonly onChange: (draft: SettingsDraft) => void
  readonly saving: boolean
  readonly error: string | null
  readonly onSave: () => void
  readonly onCancel: () => void
}

const chip = (active: boolean): { readonly background: string; readonly border: string } => ({
  background: active ? 'var(--blue-100)' : 'var(--surface-subtle)',
  border: active ? '2px solid var(--fg-brand)' : '2px solid var(--border-default)',
})

export function OutbreakSettingsView({ draft, onChange, saving, error, onSave, onCancel }: OutbreakSettingsViewProps): ReactElement {
  return (
    <div style={{ minHeight: '100%', boxSizing: 'border-box', background: 'var(--surface-app)', display: 'flex', justifyContent: 'center', padding: '56px 24px' }}>
      <div style={{ width: '100%', maxWidth: 640, background: 'var(--surface-default)', border: '1px solid var(--border-subtle)', borderRadius: 32, padding: '44px 40px', boxShadow: 'var(--elevation-600)' }}>
        <h1 style={{ margin: 0, fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 30, color: 'var(--fg-primary)', textAlign: 'center' }}>Equation Outbreak</h1>
        <div style={{ marginTop: 8, fontSize: 16, color: 'var(--fg-tertiary)', textAlign: 'center' }}>Practice settings</div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 32, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={draft.custom}
            onChange={(e) => {
              onChange({ ...draft, custom: e.target.checked })
            }}
            style={{ width: 20, height: 20 }}
          />
          <span style={{ fontWeight: 700, color: 'var(--fg-secondary)' }}>Customize which problems appear</span>
        </label>
        <div style={{ marginTop: 4, marginLeft: 30, fontSize: 14, color: 'var(--fg-tertiary)' }}>
          {draft.custom ? 'Overrides automatic difficulty until you turn this off.' : 'Check this to pick operations, focus numbers, and difficulty yourself — off, difficulty adjusts automatically as they play.'}
        </div>

        {/* Always rendered, greyed and inert while off, so it's clear there's more here to turn on. */}
        <div aria-hidden={!draft.custom} inert={!draft.custom} style={{ opacity: draft.custom ? 1 : 0.4, pointerEvents: draft.custom ? 'auto' : 'none', transition: 'opacity 120ms ease' }}>
          <div role="group" aria-labelledby="outbreak-operations" style={{ marginTop: 28 }}>
            <span id="outbreak-operations" style={{ display: 'block', marginBottom: 8, fontWeight: 700, color: 'var(--fg-secondary)' }}>
              Operations
            </span>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {OPERATIONS.map((op) => (
                <button
                  key={op.key}
                  type="button"
                  onClick={() => {
                    onChange(toggleOperation(draft, op.key))
                  }}
                  aria-pressed={draft.operations.includes(op.key)}
                  title={op.label}
                  style={{ padding: '10px 18px', borderRadius: 14, fontWeight: 700, fontSize: 18, cursor: 'pointer', color: 'var(--fg-primary)', ...chip(draft.operations.includes(op.key)) }}
                >
                  {op.key}
                </button>
              ))}
            </div>
          </div>

          {OPERATIONS.filter((op) => draft.operations.includes(op.key)).map((op) => (
            <div key={op.key} role="group" aria-label={`Focus numbers for ${op.label.toLowerCase()}`} style={{ marginTop: 24 }}>
              <span style={{ display: 'block', marginBottom: 8, fontWeight: 700, color: 'var(--fg-secondary)' }}>
                Focus numbers for {op.label.toLowerCase()} <span style={{ fontWeight: 400, color: 'var(--fg-tertiary)' }}>(optional)</span>
              </span>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {FOCUS_NUMBER_OPTIONS.map((n) => {
                  const active = (draft.focusNumbers[op.key] ?? []).includes(n)
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => {
                        onChange(toggleFocusNumber(draft, op.key, n))
                      }}
                      aria-pressed={active}
                      style={{ width: 38, height: 38, borderRadius: 9999, fontWeight: 700, fontSize: 14, cursor: 'pointer', color: 'var(--fg-primary)', ...chip(active) }}
                    >
                      {n}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}

          <label style={{ display: 'block', marginTop: 28 }}>
            <span style={{ display: 'block', marginBottom: 8, fontWeight: 700, color: 'var(--fg-secondary)' }}>
              Difficulty — {difficultyLabel(draft.difficulty)} ({draft.difficulty}/{MAX_DIFFICULTY})
            </span>
            <input
              type="range"
              min={MIN_DIFFICULTY}
              max={MAX_DIFFICULTY}
              value={draft.difficulty}
              onChange={(e) => {
                onChange({ ...draft, difficulty: Number(e.target.value) })
              }}
              style={{ width: '100%' }}
            />
          </label>
          <div style={{ fontSize: 13, color: 'var(--fg-tertiary)' }}>Bigger numbers and less time to answer as this goes up.</div>
        </div>

        {error !== null && (
          <div role="alert" style={{ marginTop: 20, color: '#CD2A20', background: '#FDF2F2', padding: 12, borderRadius: 12 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 12, marginTop: 32 }}>
          <DenButton label="Cancel" variant="quiet" size="lg" onClick={onCancel} />
          <div style={{ flex: 1 }}>
            <DenButton label={saving ? 'Saving…' : 'Save'} size="lg" full disabled={saving} onClick={onSave} />
          </div>
        </div>
      </div>
    </div>
  )
}
