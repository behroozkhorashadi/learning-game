import { useEffect, useState } from 'react'
import { DenButton } from '../components/den/DenButton'
import { CardShell, LoginForm } from '../components/AdminLoginForm'
import { ProfileFormFields, MIN_AGE, MAX_AGE, birthYearOf, ageOf } from '../components/ProfileFormFields'
import { ProfilePhotoCapture } from '../components/ProfilePhotoCapture'
import type { Profile, ProfileUpdate } from '../types/generated'

/**
 * Edit-profile screen: name, birthday, reading support, and the avatar
 * (an animal, the saved photo, or a new photo, optionally remixed). Used two
 * ways: `EditProfileForm` inside AdminPanel (already logged in), and
 * `EditProfile` from the pencil on ProfilePicker / GamePicker, which runs the
 * admin-password check itself (PATCH /api/profiles/{id} is admin-only).
 */

const isPhotoAvatar = (avatar: string) => avatar.startsWith('/static/')

export function EditProfileForm({
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
  const [avatar, setAvatar] = useState<string | null>(isPhotoAvatar(profile.avatar) ? null : profile.avatar)
  const [photo, setPhoto] = useState<string | null>(isPhotoAvatar(profile.avatar) ? profile.avatar : null)
  const [readingSupport, setReadingSupport] = useState(profile.reading_support ?? false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const birthYear = birthday ? birthYearOf(birthday) : null
  const age = birthYear != null ? ageOf(birthYear) : null
  const ageInRange = age != null && age >= MIN_AGE && age <= MAX_AGE
  const canSubmit = name.trim().length > 0 && ageInRange && (avatar != null || photo != null) && !submitting

  async function handleSubmit() {
    if (!canSubmit || birthYear == null) return
    setSubmitting(true)
    setError(null)
    const payload: ProfileUpdate = { name: name.trim(), birth_year: birthYear, reading_support: readingSupport }
    if (photo?.startsWith('data:')) payload.avatar_image_data_url = photo
    else payload.avatar = photo ?? avatar
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
        onAvatarChange={(value) => {
          setAvatar(value)
          setPhoto(null)
        }}
        readingSupport={readingSupport}
        onReadingSupportChange={setReadingSupport}
      />

      <div className="profile-avatar-divider"><span>or use a photo</span></div>
      <ProfilePhotoCapture
        value={photo}
        onChange={(value) => {
          setPhoto(value)
          if (value) setAvatar(null)
        }}
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

interface Props {
  profile: Profile
  onSaved: (profile: Profile) => void
  onCancel: () => void
}

/** Standalone entry point. Tries the empty password first so a setup with no
 * `ADMIN_PASSWORD` goes straight to the form; otherwise asks for it. */
export function EditProfile({ profile, onSaved, onCancel }: Props) {
  const [adminPassword, setAdminPassword] = useState<string | null>(null)
  const [needsPassword, setNeedsPassword] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: '' }),
    })
      .then((res) => {
        if (cancelled) return
        if (res.ok) setAdminPassword('')
        else setNeedsPassword(true)
      })
      .catch(() => !cancelled && setNeedsPassword(true))
    return () => {
      cancelled = true
    }
  }, [])

  if (adminPassword != null) {
    return <EditProfileForm profile={profile} adminPassword={adminPassword} onSaved={onSaved} onCancel={onCancel} />
  }
  if (needsPassword) {
    return <LoginForm onAuthenticated={setAdminPassword} onCancel={onCancel} />
  }
  return null
}
