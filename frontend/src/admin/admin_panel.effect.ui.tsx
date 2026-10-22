import { useState, type ComponentType, type ReactElement } from 'react'
import type { EngagementSummaryRecord } from '@app/api/engagement_api.effect.lib.ts'
import type { ProfileAuth, ProfileRecord } from '@app/api/profiles_schema.pure.lib.ts'
import { DenButton } from '@app/den/den_button.pure.ui.tsx'
import type { EditProfileProps } from '@app/profiles/edit_profile.effect.ui.tsx'
import { CardShell } from '@app/profiles/card_shell.pure.ui.tsx'
import { ProfileAvatar } from '@app/profiles/profile_avatar.pure.ui.tsx'
import { ageOf, yearOf } from '@app/profiles/profile_form.pure.lib.ts'
import { errorMessage } from '@app/query/query_state.pure.lib.ts'
import type { QueryState } from '@app/query/query_state.pure.lib.ts'
import { useReloadableQuery } from '@app/query/use_reloadable_query.pure.hook.ts'
import type { AdminLoginProps } from './admin_login.effect.ui.tsx'

/**
 * Admin screen: password-gated player management (edit/remove), reached via
 * the small "Admin" link on the picker.
 *
 * The password check is a UX nicety, not the real gate: `POST
 * /api/admin/login` and the `X-Admin-Password` header on each PATCH/DELETE
 * exist only to stop a curious kid with curl, not a motivated attacker (see
 * backend/app/admin_auth.py). Nothing here secures anything beyond that.
 */

export interface AdminPanelProps {
  readonly onClose: () => void
}

export interface AdminPanelDeps {
  readonly listProfiles: () => Promise<readonly ProfileRecord[]>
  readonly removeProfile: (id: number, auth: ProfileAuth) => Promise<void>
  readonly engagementSummary: (adminPassword: string) => Promise<readonly EngagementSummaryRecord[]>
  readonly AdminLogin: ComponentType<AdminLoginProps>
  readonly EditProfile: ComponentType<EditProfileProps>
  /** Today as `YYYY-MM-DD`, for the ages shown. */
  readonly today: () => string
}

export function bindAdminPanel({ listProfiles, removeProfile, engagementSummary, AdminLogin, EditProfile, today }: AdminPanelDeps): ComponentType<AdminPanelProps> {
  function PlayerRow({ profile, auth, currentYear, onEdit, onDeleted }: { readonly profile: ProfileRecord; readonly auth: ProfileAuth; readonly currentYear: number; readonly onEdit: () => void; readonly onDeleted: () => void }): ReactElement {
    const [confirming, setConfirming] = useState(false)
    const [deleting, setDeleting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    async function handleDelete(): Promise<void> {
      setDeleting(true)
      setError(null)
      try {
        await removeProfile(profile.id, auth)
        onDeleted()
      } catch (err) {
        setError(errorMessage(err))
        setDeleting(false)
      }
    }

    return (
      <li style={{ listStyle: 'none', border: '2px solid var(--border-default)', borderRadius: 16, padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 9999, background: 'var(--surface-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', fontWeight: 800, color: 'var(--fg-brand)' }}>
              <ProfileAvatar avatar={profile.avatar} name={profile.name} />
            </div>
            <div>
              <div style={{ fontWeight: 700, color: 'var(--fg-primary)' }}>{profile.name}</div>
              <div style={{ fontSize: 13, color: 'var(--fg-tertiary)' }}>
                Age {ageOf(profile.birth_year, currentYear)}
                {profile.has_password && ' · 🔒 Has a password'}
              </div>
            </div>
          </div>

          {!confirming && (
            <div style={{ display: 'flex', gap: 8 }}>
              <DenButton label="Edit" ariaLabel={`Edit ${profile.name}`} variant="quiet" size="sm" onClick={onEdit} />
              <DenButton
                label="Delete"
                ariaLabel={`Delete ${profile.name}`}
                variant="quiet"
                size="sm"
                onClick={() => {
                  setConfirming(true)
                }}
              />
            </div>
          )}
        </div>

        {confirming && (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: 14, color: 'var(--fg-secondary)', marginBottom: 10 }}>Remove {profile.name} and all of their progress? This can&apos;t be undone.</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <DenButton
                label="Cancel"
                variant="quiet"
                size="sm"
                onClick={() => {
                  setConfirming(false)
                }}
                disabled={deleting}
              />
              <DenButton label={deleting ? 'Removing…' : 'Yes, remove'} variant="softAmber" size="sm" onClick={() => void handleDelete()} disabled={deleting} />
            </div>
          </div>
        )}

        {error !== null && (
          <div role="alert" style={{ marginTop: 10, fontSize: 13, color: '#CD2A20' }}>
            {error}
          </div>
        )}
      </li>
    )
  }

  function PlayerList({ state, auth, currentYear, onEdit, onChanged }: { readonly state: QueryState<readonly ProfileRecord[]>; readonly auth: ProfileAuth; readonly currentYear: number; readonly onEdit: (profile: ProfileRecord) => void; readonly onChanged: () => void }): ReactElement {
    return (
      <>
        {state.kind === 'failed' && (
          <div role="alert" style={{ marginTop: 20, color: '#CD2A20', background: '#FDF2F2', padding: 12, borderRadius: 12 }}>
            {state.message}
          </div>
        )}
        <ul aria-label="Players" style={{ display: 'flex', flexDirection: 'column', gap: 12, margin: '32px 0 0', padding: 0 }}>
          {(state.kind === 'loaded' ? state.data : []).map((p) => (
            <PlayerRow
              key={p.id}
              profile={p}
              auth={auth}
              currentYear={currentYear}
              onEdit={() => {
                onEdit(p)
              }}
              onDeleted={onChanged}
            />
          ))}
        </ul>
      </>
    )
  }

  /** The logged-in screen. Mounted only after login, so the list is never read without the admin password. */
  function Players({ auth, onClose }: { readonly auth: { readonly kind: 'admin'; readonly password: string }; readonly onClose: () => void }): ReactElement {
    const [currentYear] = useState(() => yearOf(today()))
    const players = useReloadableQuery(listProfiles)
    const engagement = useReloadableQuery(() => engagementSummary(auth.password))
    const [editing, setEditing] = useState<ProfileRecord | null>(null)

    if (editing !== null) {
      return (
        <EditProfile
          key={editing.id}
          profile={editing}
          auth={auth}
          onSaved={() => {
            setEditing(null)
            players.reload()
          }}
          onCancel={() => {
            setEditing(null)
          }}
        />
      )
    }

    return (
      <CardShell>
        <h1 style={{ margin: 0, fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 32, color: 'var(--fg-primary)', textAlign: 'center' }}>Players</h1>
        <div style={{ marginTop: 8, fontSize: 16, color: 'var(--fg-tertiary)', textAlign: 'center' }}>Edit or remove a player.</div>

        <div style={{ marginTop: 'var(--space-8)', padding: 'var(--space-4)', border: 'thin solid var(--border-default)', borderRadius: 'var(--radius-lg)', background: 'var(--surface-subtle)' }}>
          <div role="heading" aria-level={2} style={{ fontFamily: 'var(--font-display)', fontWeight: 800, color: 'var(--fg-primary)' }}>Active time by area</div>
          <div style={{ marginTop: 'var(--space-1)', color: 'var(--fg-tertiary)' }}>Hidden tabs and periods without interaction are excluded.</div>
          {engagement.state.kind === 'failed' && <div role="alert" style={{ marginTop: 'var(--space-3)', color: 'var(--fg-warning)' }}>{engagement.state.message}</div>}
          {engagement.state.kind === 'loaded' && (
            <ul aria-label="Active time by area" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', margin: 'var(--space-4) 0 0', padding: 0 }}>
              {engagement.state.data.map((item) => (
                <li key={item.area} style={{ listStyle: 'none', display: 'flex', justifyContent: 'space-between', gap: 'var(--space-4)', color: 'var(--fg-secondary)' }}>
                  <span>{item.area.replaceAll('_', ' ').replaceAll(':', ' · ')}</span>
                  <strong>{formatActiveTime(item.active_ms)}</strong>
                </li>
              ))}
              {engagement.state.data.length === 0 && <li style={{ listStyle: 'none', color: 'var(--fg-tertiary)' }}>No active time recorded yet.</li>}
            </ul>
          )}
        </div>

        <PlayerList state={players.state} auth={auth} currentYear={currentYear} onEdit={setEditing} onChanged={players.reload} />

        <div style={{ marginTop: 32 }}>
          <DenButton label="Back" variant="quiet" size="lg" onClick={onClose} />
        </div>
      </CardShell>
    )
  }

  function AdminPanel({ onClose }: AdminPanelProps): ReactElement {
    const [auth, setAuth] = useState<{ readonly kind: 'admin'; readonly password: string } | null>(null)
    if (auth === null) {
      return (
        <AdminLogin
          onAuthenticated={(password) => {
            setAuth({ kind: 'admin', password })
          }}
          onCancel={onClose}
        />
      )
    }
    return <Players auth={auth} onClose={onClose} />
  }
  return AdminPanel
}

function formatActiveTime(ms: number): string {
  if (ms < 60_000) return `${String(Math.max(1, Math.round(ms / 1000)))} sec`
  const minutes = Math.round(ms / 60_000)
  if (minutes < 60) return `${String(minutes)} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0 ? `${String(hours)} hr` : `${String(hours)} hr ${String(rest)} min`
}
