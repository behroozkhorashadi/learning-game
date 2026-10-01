import { useEffect, useState } from 'react'
import { DenButton } from '../components/den/DenButton'
import { CardShell, LoginForm } from '../components/AdminLoginForm'
import { ageOf } from '../components/ProfileFormFields'
import { ProfileAvatar } from './ProfilePicker'
import { EditProfile } from './EditProfile'
import type { Profile } from '../types/generated'

/**
 * Admin screen — password-gated player management (edit/remove). Reached via
 * a small "Admin" link on ProfilePicker.
 *
 * The password check here is a UX nicety, not the real gate: `POST
 * /api/admin/login` and the header this screen then attaches to every
 * PATCH/DELETE both exist only to stop a curious kid from finding these
 * endpoints with curl, not a motivated attacker — see
 * `backend/app/admin_auth.py`'s docstring for the full caveat. Nothing here
 * should be treated as securing anything beyond that.
 *
 * An empty password is deliberately submittable: an unset `ADMIN_PASSWORD`
 * on the backend means the password *is* the empty string, so blocking a
 * blank submit here would lock the admin screen out of exactly the
 * no-password setup the backend supports.
 */

interface Props {
  onClose: () => void
}

function ProfileRow({
  profile,
  adminPassword,
  onEdit,
  onDeleted,
}: {
  profile: Profile
  adminPassword: string
  onEdit: () => void
  onDeleted: () => void
}) {
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDelete() {
    setDeleting(true)
    setError(null)
    try {
      const res = await fetch(`/api/profiles/${profile.id}`, {
        method: 'DELETE',
        headers: { 'X-Admin-Password': adminPassword },
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.detail ?? `DELETE /api/profiles/${profile.id} -> ${res.status}`)
      }
      onDeleted()
    } catch (err) {
      setError(String(err))
      setDeleting(false)
    }
  }

  return (
    <div style={{ border: '2px solid var(--border-default)', borderRadius: 16, padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 9999,
              background: 'var(--surface-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              fontWeight: 800,
              color: 'var(--fg-brand)',
            }}
          >
            <ProfileAvatar avatar={profile.avatar} name={profile.name} />
          </div>
          <div>
            <div style={{ fontWeight: 700, color: 'var(--fg-primary)' }}>{profile.name}</div>
            <div style={{ fontSize: 13, color: 'var(--fg-tertiary)' }}>
              Age {ageOf(profile.birth_year)}
              {profile.has_password && ' · 🔒 Has a password'}
            </div>
          </div>
        </div>

        {!confirming && (
          <div style={{ display: 'flex', gap: 8 }}>
            <DenButton label="Edit" variant="quiet" size="sm" onClick={onEdit} />
            <DenButton label="Delete" variant="quiet" size="sm" onClick={() => setConfirming(true)} />
          </div>
        )}
      </div>

      {confirming && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: 14, color: 'var(--fg-secondary)', marginBottom: 10 }}>
            Remove {profile.name} and all of their progress? This can't be undone.
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <DenButton label="Cancel" variant="quiet" size="sm" onClick={() => setConfirming(false)} disabled={deleting} />
            <DenButton label={deleting ? 'Removing…' : 'Yes, remove'} variant="softAmber" size="sm" onClick={handleDelete} disabled={deleting} />
          </div>
        </div>
      )}

      {error && <div style={{ marginTop: 10, fontSize: 13, color: '#CD2A20' }}>{error}</div>}
    </div>
  )
}

export function AdminPanel({ onClose }: Props) {
  const [adminPassword, setAdminPassword] = useState<string | null>(null)
  const [profiles, setProfiles] = useState<Profile[] | null>(null)
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null)
  const [listError, setListError] = useState<string | null>(null)

  function refetchProfiles() {
    fetch('/api/profiles')
      .then((res) => {
        if (!res.ok) throw new Error(`GET /api/profiles -> ${res.status}`)
        return res.json()
      })
      .then(setProfiles)
      .catch((err) => setListError(String(err)))
  }

  useEffect(() => {
    if (adminPassword != null) refetchProfiles()
  }, [adminPassword])

  if (adminPassword == null) {
    return <LoginForm onAuthenticated={setAdminPassword} onCancel={onClose} />
  }

  if (editingProfile != null) {
    return (
      <EditProfile
        profile={editingProfile}
        authHeaders={{ 'X-Admin-Password': adminPassword }}
        onSaved={() => {
          setEditingProfile(null)
          refetchProfiles()
        }}
        onCancel={() => setEditingProfile(null)}
      />
    )
  }

  return (
    <CardShell>
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 32, color: 'var(--fg-primary)', textAlign: 'center' }}>Players</div>
      <div style={{ marginTop: 8, fontSize: 16, color: 'var(--fg-tertiary)', textAlign: 'center' }}>Edit or remove a player.</div>

      {listError && <div style={{ marginTop: 20, color: '#CD2A20', background: '#FDF2F2', padding: 12, borderRadius: 12 }}>{listError}</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 32 }}>
        {(profiles ?? []).map((p) => (
          <ProfileRow key={p.id} profile={p} adminPassword={adminPassword} onEdit={() => setEditingProfile(p)} onDeleted={refetchProfiles} />
        ))}
      </div>

      <div style={{ marginTop: 32 }}>
        <DenButton label="Back" variant="quiet" size="lg" onClick={onClose} />
      </div>
    </CardShell>
  )
}
