import { useState } from 'react'
import { DenButton } from '../components/den/DenButton'
import { CardShell } from '../components/AdminLoginForm'
import { ProfileFormFields, MIN_AGE, MAX_AGE, birthYearOf, ageOf } from '../components/ProfileFormFields'
import { ProfilePhotoCapture } from '../components/ProfilePhotoCapture'
import { ProfilePasswordFields, EMPTY_PASSWORD_DRAFT, passwordDraftError } from '../components/ProfilePasswordFields'
import type { Profile, ProfileUpdate } from '../types/generated'

/**
 * Edit-profile screen: name, birthday, reading support, password, and the
 * avatar (an animal, the saved photo, or a new photo, optionally remixed).
 *
 * The caller has already checked whoever is editing and passes the matching
 * header in `authHeaders`: `X-Profile-Password` from App (the password typed
 * into ProfileUnlock — the profile's own, or the admin password as an
 * override), or `X-Admin-Password` from AdminPanel. An unprotected profile
 * needs no header at all.
 */

const isPhotoAvatar = (avatar: string) => avatar.startsWith('/static/')

interface Props {
  profile: Profile
  authHeaders: Record<string, string>
  /** `password` is the profile's new password if it was set or changed,
   * null if it was removed, and undefined if it didn't change. */
  onSaved: (profile: Profile, password?: string | null) => void
  onCancel: () => void
}

export function EditProfile({ profile, authHeaders, onSaved, onCancel }: Props) {
  const [name, setName] = useState(profile.name)
  const [birthday, setBirthday] = useState(`${profile.birth_year}-01-01`)
  const [avatar, setAvatar] = useState<string | null>(isPhotoAvatar(profile.avatar) ? null : profile.avatar)
  const [photo, setPhoto] = useState<string | null>(isPhotoAvatar(profile.avatar) ? profile.avatar : null)
  const [readingSupport, setReadingSupport] = useState(profile.reading_support ?? false)
  const [passwordDraft, setPasswordDraft] = useState(EMPTY_PASSWORD_DRAFT)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const birthYear = birthday ? birthYearOf(birthday) : null
  const age = birthYear != null ? ageOf(birthYear) : null
  const ageInRange = age != null && age >= MIN_AGE && age <= MAX_AGE
  const canSubmit =
    name.trim().length > 0 && ageInRange && (avatar != null || photo != null) && passwordDraftError(passwordDraft) == null && !submitting

  async function handleSubmit() {
    if (!canSubmit || birthYear == null) return
    setSubmitting(true)
    setError(null)
    const payload: ProfileUpdate = { name: name.trim(), birth_year: birthYear, reading_support: readingSupport }
    if (photo?.startsWith('data:')) payload.avatar_image_data_url = photo
    else payload.avatar = photo ?? avatar
    if (passwordDraft.remove) payload.remove_password = true
    else if (passwordDraft.password) payload.password = passwordDraft.password
    try {
      const res = await fetch(`/api/profiles/${profile.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.detail ?? `PATCH /api/profiles/${profile.id} -> ${res.status}`)
      }
      const updated: Profile = await res.json()
      onSaved(updated, passwordDraft.remove ? null : passwordDraft.password || undefined)
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

      <ProfilePasswordFields draft={passwordDraft} onChange={setPasswordDraft} hasPassword={profile.has_password ?? false} />

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
