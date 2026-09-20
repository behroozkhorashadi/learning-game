import { useEffect, useState, type ReactNode } from 'react'
import { DenButton } from '../components/den/DenButton'
import { ProfileFormFields, MIN_AGE, MAX_AGE, birthYearOf, ageOf } from '../components/ProfileFormFields'
import type { Profile, ProfileUpdate } from '../types/generated'

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
 */

interface Props {
  onClose: () => void
}

function CardShell({ children }: { children: ReactNode }) {
  return (
    <div style={{ minHeight: '100%', boxSizing: 'border-box', background: 'var(--surface-app)', display: 'flex', justifyContent: 'center', padding: '56px 24px' }}>
      <div style={{ width: '100%', maxWidth: 560, background: 'var(--surface-default)', border: '1px solid var(--border-subtle)', borderRadius: 32, padding: '44px 40px', boxShadow: 'var(--elevation-600)' }}>
        {children}
      </div>
    </div>
  )
}

function LoginForm({ onAuthenticated, onCancel }: { onAuthenticated: (password: string) => void; onCancel: () => void }) {
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (res.status === 401) {
        setError('Incorrect password.')
        return
      }
      if (!res.ok) throw new Error(`POST /api/admin/login -> ${res.status}`)
      onAuthenticated(password)
    } catch (err) {
      setError(String(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <CardShell>
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 32, color: 'var(--fg-primary)', textAlign: 'center' }}>Admin</div>
      <div style={{ marginTop: 8, fontSize: 16, color: 'var(--fg-tertiary)', textAlign: 'center' }}>Enter the admin password.</div>

      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && password && !submitting) handleSubmit()
        }}
        placeholder="Password"
        autoFocus
        style={{
          width: '100%',
          boxSizing: 'border-box',
          marginTop: 32,
          padding: '14px 16px',
          fontSize: 16,
          borderRadius: 14,
          border: '2px solid var(--border-default)',
          background: 'var(--surface-subtle)',
          color: 'var(--fg-primary)',
          outline: 'none',
        }}
      />

      {error && <div style={{ marginTop: 20, color: '#CD2A20', background: '#FDF2F2', padding: 12, borderRadius: 12 }}>{error}</div>}

      <div style={{ display: 'flex', gap: 12, marginTop: 32 }}>
        <DenButton label="Back" variant="quiet" size="lg" onClick={onCancel} />
        <div style={{ flex: 1 }}>
          <DenButton label={submitting ? 'Checking…' : 'Enter'} size="lg" full disabled={!password || submitting} onClick={handleSubmit} />
        </div>
      </div>
    </CardShell>
  )
}

function EditForm({
  profile,
  adminPassword,
  onSaved,
  onCancel,
}: {
  profile: Profile
  adminPassword: string
  onSaved: (profile: Profile) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(profile.name)
  const [birthday, setBirthday] = useState(`${profile.birth_year}-01-01`)
  const [avatar, setAvatar] = useState<string | null>(profile.avatar)
  const [readingSupport, setReadingSupport] = useState(profile.reading_support ?? false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const birthYear = birthday ? birthYearOf(birthday) : null
  const age = birthYear != null ? ageOf(birthYear) : null
  const ageInRange = age != null && age >= MIN_AGE && age <= MAX_AGE
  const canSubmit = name.trim().length > 0 && ageInRange && avatar != null && !submitting

  async function handleSubmit() {
    if (!canSubmit || birthYear == null || avatar == null) return
    setSubmitting(true)
    setError(null)
    const payload: ProfileUpdate = { name: name.trim(), avatar, birth_year: birthYear, reading_support: readingSupport }
    try {
      const res = await fetch(`/api/profiles/${profile.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Password': adminPassword },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.detail ?? `PATCH /api/profiles/${profile.id} -> ${res.status}`)
      }
      const updated: Profile = await res.json()
      onSaved(updated)
    } catch (err) {
      setError(String(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <CardShell>
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 32, color: 'var(--fg-primary)', textAlign: 'center' }}>
        Edit {profile.name}
      </div>

      <ProfileFormFields
        name={name}
        onNameChange={setName}
        birthday={birthday}
        onBirthdayChange={setBirthday}
        avatar={avatar}
        onAvatarChange={setAvatar}
        readingSupport={readingSupport}
        onReadingSupportChange={setReadingSupport}
      />

      {error && <div style={{ marginTop: 20, color: '#CD2A20', background: '#FDF2F2', padding: 12, borderRadius: 12 }}>{error}</div>}

      <div style={{ display: 'flex', gap: 12, marginTop: 32 }}>
        <DenButton label="Cancel" variant="quiet" size="lg" onClick={onCancel} />
        <div style={{ flex: 1 }}>
          <DenButton label={submitting ? 'Saving…' : 'Save changes'} size="lg" full disabled={!canSubmit} onClick={handleSubmit} />
        </div>
      </div>
    </CardShell>
  )
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
              fontWeight: 800,
              color: 'var(--fg-brand)',
            }}
          >
            {profile.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ fontWeight: 700, color: 'var(--fg-primary)' }}>{profile.name}</div>
            <div style={{ fontSize: 13, color: 'var(--fg-tertiary)' }}>Age {ageOf(profile.birth_year)}</div>
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
      <EditForm
        profile={editingProfile}
        adminPassword={adminPassword}
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
