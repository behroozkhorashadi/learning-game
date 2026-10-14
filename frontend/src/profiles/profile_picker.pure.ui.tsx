import type { ReactElement } from 'react'
import type { ParentRecord } from '@app/api/parents_schema.pure.lib.ts'
import type { ProfileRecord } from '@app/api/profiles_schema.pure.lib.ts'
import { PENCIL_ICON } from '@app/den/icon_paths.pure.lib.ts'
import type { QueryState } from '@app/query/query_state.pure.lib.ts'
import { ParentBadge } from '@app/parents/parent_badge.pure.ui.tsx'
import { ProfileAvatar } from './profile_avatar.pure.ui.tsx'

/**
 * Profile picker — ported from the Claude Design handoff bundle
 * (`Entry Screens.dc.html`, "PROFILE PICKER" section). Props only: the list
 * arrives as a QueryState from the bound screen (profile_picker.effect.ui.tsx);
 * picking one is purely a client-side navigation choice, nothing the server
 * needs to know about ahead of time.
 */

const RING_THEMES = [
  { ring: '#EBDCFE', lip: '#CBA6FC', text: '#5006B2' },
  { ring: '#DBE4FF', lip: '#A3BAFF', text: '#00289E' },
  { ring: '#DBF5D1', lip: '#A1E486', text: '#2C6416' },
] as const

/** What the screen's caller (the app shell) handles. */
export interface ProfilePickerProps {
  readonly onSelect: (profile: ProfileRecord) => void
  readonly onAddPlayer: () => void
  readonly onEditProfile: (profile: ProfileRecord) => void
  readonly onOpenAdmin: () => void
  /** A grown-up picked their name: they sign in to the parent dashboard. */
  readonly onSelectParent: (parent: ParentRecord) => void
  /** "I'm a parent": make a parent account. */
  readonly onAddParent: () => void
}

export interface ProfilePickerViewProps extends ProfilePickerProps {
  readonly state: QueryState<readonly ProfileRecord[]>
  /** The parent accounts, for the grown-ups row. A failure there only hides the row. */
  readonly parents: QueryState<readonly ParentRecord[]>
}

export function ProfilePickerView({ state, parents, onSelect, onAddPlayer, onEditProfile, onOpenAdmin, onSelectParent, onAddParent }: ProfilePickerViewProps): ReactElement {
  const profiles = state.kind === 'loaded' ? state.data : []
  return (
    <div style={{ minHeight: '100%', boxSizing: 'border-box', background: 'var(--surface-app)', display: 'flex', justifyContent: 'center', padding: '56px 24px' }}>
      <div style={{ width: '100%', maxWidth: 820, background: 'var(--surface-default)', border: '1px solid var(--border-subtle)', borderRadius: 32, padding: '52px 44px', boxShadow: 'var(--elevation-600)', textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 40, lineHeight: 1.05, color: 'var(--fg-primary)' }}>
          Who&apos;s playing?
        </div>
        <div style={{ marginTop: 10, fontSize: 18, color: 'var(--fg-tertiary)' }}>Tap your face to start.</div>

        {state.kind === 'failed' && (
          <pre style={{ marginTop: 24, color: '#CD2A20', background: '#FDF2F2', padding: 12, borderRadius: 12, textAlign: 'left' }}>Error: {state.message}</pre>
        )}

        <div style={{ display: 'flex', justifyContent: 'center', gap: 28, flexWrap: 'wrap', marginTop: 40 }}>
          {profiles.map((p, i) => {
            const theme = RING_THEMES[i % RING_THEMES.length] ?? RING_THEMES[0]
            return (
              <div key={p.id} style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => {
                    onSelect(p)
                  }}
                  aria-label={p.has_password ? `Play as ${p.name} (needs a password)` : `Play as ${p.name}`}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, background: 'transparent', border: 'none', cursor: 'pointer', padding: 8 }}
                >
                  <div style={{ width: 150, height: 150, borderRadius: 9999, padding: 6, background: theme.ring, boxShadow: `0 8px 0 ${theme.lip}`, boxSizing: 'border-box' }}>
                    <div style={{ width: '100%', height: '100%', borderRadius: 9999, overflow: 'hidden', background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 52, color: theme.text }}>
                      <ProfileAvatar avatar={p.avatar} name={p.name} />
                    </div>
                  </div>
                  <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 24, color: 'var(--fg-primary)' }}>
                    {p.has_password && <span aria-hidden="true" style={{ fontSize: 18, marginRight: 6 }}>🔒</span>}
                    {p.name}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onEditProfile(p)
                  }}
                  aria-label={`Edit ${p.name}`}
                  title={`Edit ${p.name}`}
                  style={{ position: 'absolute', top: 8, right: 4, width: 40, height: 40, borderRadius: 9999, border: '2px solid var(--border-default)', background: 'var(--surface-default)', color: 'var(--fg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                >
                  <svg width={18} height={18} viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d={PENCIL_ICON} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            )
          })}

          {state.kind === 'loaded' && (
            <button
              type="button"
              onClick={onAddPlayer}
              aria-label="Add a player"
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, background: 'transparent', border: 'none', cursor: 'pointer', padding: 8 }}
            >
              <div
                style={{
                  width: 150,
                  height: 150,
                  borderRadius: 9999,
                  boxSizing: 'border-box',
                  border: '3px dashed var(--border-default)',
                  background: 'var(--surface-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 52,
                  fontWeight: 800,
                  color: 'var(--fg-tertiary)',
                }}
              >
                +
              </div>
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 24, color: 'var(--fg-tertiary)' }}>Add a player</span>
            </button>
          )}
        </div>

        {state.kind === 'loaded' && parents.kind !== 'failed' && (
          <div style={{ marginTop: 44, paddingTop: 24, borderTop: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--fg-tertiary)', textTransform: 'uppercase', letterSpacing: 0.6 }}>Grown-ups</div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap', marginTop: 14 }}>
              {(parents.kind === 'loaded' ? parents.data : []).map((parent) => (
                <button
                  key={parent.id}
                  type="button"
                  onClick={() => {
                    onSelectParent(parent)
                  }}
                  aria-label={`Parent dashboard for ${parent.name}`}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px 8px 8px', borderRadius: 9999, border: '2px solid var(--border-default)', background: 'var(--surface-default)', cursor: 'pointer' }}
                >
                  <ParentBadge name={parent.name} size={36} />
                  <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--fg-primary)' }}>🔒 {parent.name}</span>
                </button>
              ))}
              <button
                type="button"
                onClick={onAddParent}
                style={{ padding: '10px 18px', borderRadius: 9999, border: '2px dashed var(--border-default)', background: 'var(--surface-subtle)', cursor: 'pointer', fontWeight: 700, fontSize: 16, color: 'var(--fg-secondary)' }}
              >
                I&apos;m a parent
              </button>
            </div>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={onOpenAdmin}
        style={{
          position: 'fixed',
          bottom: 16,
          left: 20,
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          fontSize: 13,
          color: 'var(--fg-disabled)',
        }}
      >
        Admin
      </button>
    </div>
  )
}
