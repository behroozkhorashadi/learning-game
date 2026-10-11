import { useState, type ComponentType, type ReactElement } from 'react'
import type { ProfileAuth, ProfileRecord } from '@app/api/profiles_schema.pure.lib.ts'
import { DenButton } from '@app/den/den_button.pure.ui.tsx'
import { errorMessage } from '@app/query/query_state.pure.lib.ts'
import { CardShell } from './card_shell.pure.ui.tsx'
import { isPhotoAvatar, passwordAfterSave, profileUpdateFrom, type ProfileUpdateBody } from './edit_profile_draft.pure.lib.ts'
import { ProfileFormFields } from './profile_form_fields.pure.ui.tsx'
import { yearOf } from './profile_form.pure.lib.ts'
import { EMPTY_PASSWORD_DRAFT, type PasswordDraft } from './profile_password.pure.lib.ts'
import { ProfilePasswordFields } from './profile_password_fields.pure.ui.tsx'
import type { ProfilePhotoCaptureProps } from './profile_photo_capture.effect.ui.tsx'
import type { NewPhoto, SavedPhoto } from './profile_photo_state.pure.lib.ts'
import { useSavedPhotos } from './use_saved_photos.pure.hook.ts'

/**
 * Edit-profile screen: name, birthday, reading support, password, and the
 * avatar: an animal, any of the profile's saved pictures, or a new photo,
 * optionally remixed. Every new photo/remix is saved with the profile so it
 * can be switched back to later.
 *
 * The caller has already checked whoever is editing and passes the matching
 * `auth`: the password typed into ProfileUnlock (the profile's own, or the
 * admin password as an override), the admin screen's password, or none for
 * an unprotected profile.
 */

/** Key this screen by `profile.id`: the form and its photo list belong to one editing session. */
export interface EditProfileProps {
  readonly profile: ProfileRecord
  readonly auth: ProfileAuth
  /** `password` is the profile's new password if it was set or changed, null if it was removed, and undefined if it didn't change. */
  readonly onSaved: (profile: ProfileRecord, password: string | null | undefined) => void
  readonly onCancel: () => void
}

export interface EditProfileDeps {
  readonly updateProfile: (id: number, body: ProfileUpdateBody, auth: ProfileAuth) => Promise<ProfileRecord>
  readonly listPhotos: (id: number, auth: ProfileAuth) => Promise<readonly SavedPhoto[]>
  readonly deletePhoto: (id: number, photoId: number, auth: ProfileAuth) => Promise<void>
  readonly PhotoCapture: ComponentType<ProfilePhotoCaptureProps>
  /** Today as `YYYY-MM-DD`. Read once per mount. */
  readonly today: () => string
}

export function bindEditProfile({ updateProfile, listPhotos, deletePhoto, PhotoCapture, today }: EditProfileDeps): ComponentType<EditProfileProps> {
  function EditProfile({ profile, auth, onSaved, onCancel }: EditProfileProps): ReactElement {
    const [todayIso] = useState(today)
    const currentYear = yearOf(todayIso)
    const savedAvatar = isPhotoAvatar(profile.avatar) ? profile.avatar : null
    const [name, setName] = useState(profile.name)
    const [birthday, setBirthday] = useState(`${String(profile.birth_year)}-01-01`)
    const [avatar, setAvatar] = useState<string | null>(savedAvatar === null ? profile.avatar : null)
    const [photo, setPhoto] = useState<string | null>(savedAvatar)
    const [newPhotos, setNewPhotos] = useState<readonly NewPhoto[]>([])
    const [readingSupport, setReadingSupport] = useState(profile.reading_support)
    const [passwordDraft, setPasswordDraft] = useState<PasswordDraft>(EMPTY_PASSWORD_DRAFT)
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // One editing session per mount: the caller keys this screen by profile id, so the profile and auth it opened with are fixed.
    const [load] = useState(() => () => listPhotos(profile.id, auth))
    const [remove] = useState(() => (saved: SavedPhoto) => deletePhoto(profile.id, saved.id, auth))
    const saved = useSavedPhotos(load, remove)

    const body = profileUpdateFrom({ name, birthday, avatar, photo, newPhotos, readingSupport, password: passwordDraft }, currentYear)
    const canSubmit = body !== null && !submitting

    async function deleteSavedPhoto(photoToDelete: SavedPhoto): Promise<void> {
      await saved.remove(photoToDelete)
      if (photo === photoToDelete.url) setPhoto(null)
    }

    async function handleSubmit(): Promise<void> {
      if (body === null || submitting) return
      setSubmitting(true)
      setError(null)
      try {
        const updated = await updateProfile(profile.id, body, auth)
        onSaved(updated, passwordAfterSave(passwordDraft))
      } catch (err) {
        setError(errorMessage(err))
      } finally {
        setSubmitting(false)
      }
    }

    return (
      <CardShell>
        <h1 style={{ margin: 0, fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 32, color: 'var(--fg-primary)', textAlign: 'center' }}>Edit {profile.name}</h1>

        <ProfileFormFields
          today={todayIso}
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

        <ProfilePasswordFields draft={passwordDraft} onChange={setPasswordDraft} hasPassword={profile.has_password} />

        <div className="profile-avatar-divider">
          <span>or use a photo</span>
        </div>
        <PhotoCapture
          value={photo}
          onNewPhotosChange={setNewPhotos}
          savedPhotos={saved.photos}
          currentSavedUrl={savedAvatar}
          onDeleteSaved={deleteSavedPhoto}
          onChange={(value) => {
            setPhoto(value)
            if (value !== null) setAvatar(null)
          }}
        />

        {error !== null && (
          <div role="alert" style={{ marginTop: 20, color: '#CD2A20', background: '#FDF2F2', padding: 12, borderRadius: 12 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 12, marginTop: 32 }}>
          <DenButton label="Cancel" variant="quiet" size="lg" onClick={onCancel} />
          <div style={{ flex: 1 }}>
            <DenButton label={submitting ? 'Saving…' : 'Save changes'} size="lg" full disabled={!canSubmit} onClick={() => void handleSubmit()} />
          </div>
        </div>
      </CardShell>
    )
  }
  return EditProfile
}
