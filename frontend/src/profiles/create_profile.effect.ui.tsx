import { useState, type ComponentType, type ReactElement } from 'react'
import type { ProfileRecord } from '@app/api/profiles_schema.pure.lib.ts'
import { DenButton } from '@app/den/den_button.pure.ui.tsx'
import { errorMessage } from '@app/query/query_state.pure.lib.ts'
import { profileCreateFrom, type ProfileCreateBody } from './create_profile_draft.pure.lib.ts'
import { ProfileFormFields } from './profile_form_fields.pure.ui.tsx'
import { defaultReadingSupport, yearOf } from './profile_form.pure.lib.ts'
import { EMPTY_PASSWORD_DRAFT, type PasswordDraft } from './profile_password.pure.lib.ts'
import { ProfilePasswordFields } from './profile_password_fields.pure.ui.tsx'
import type { ProfilePhotoCaptureProps } from './profile_photo_capture.effect.ui.tsx'
import type { NewPhoto } from './profile_photo_state.pure.lib.ts'

/**
 * Create-profile screen, reached from the picker's "+ Add a player" tile.
 * Collects everything `ProfileCreate` needs: a name, a birthday (only the
 * year is persisted), and an avatar or photo. `reading_support` defaults from
 * age (PRD §8: "on by default for the 6 band") but stays a plain checkbox the
 * parent can override either way.
 */

export interface CreateProfileProps {
  /** `password` is the one just set, or null. The shell keeps it so the new player can edit their profile without being asked for it again. */
  readonly onCreated: (profile: ProfileRecord, password: string | null) => void
  readonly onCancel: () => void
}

export interface CreateProfileDeps {
  /** POST /api/profiles. In the app, the profiles API adapter's `create`. */
  readonly createProfile: (body: ProfileCreateBody) => Promise<ProfileRecord>
  /** The bound photo panel (profile_photo_capture.effect.ui.tsx). */
  readonly PhotoCapture: ComponentType<ProfilePhotoCaptureProps>
  /** Today as `YYYY-MM-DD`. Read once per mount. */
  readonly today: () => string
}

export function bindCreateProfile({ createProfile, PhotoCapture, today }: CreateProfileDeps): ComponentType<CreateProfileProps> {
  function CreateProfile({ onCreated, onCancel }: CreateProfileProps): ReactElement {
    const [todayIso] = useState(today)
    const currentYear = yearOf(todayIso)
    const [name, setName] = useState('')
    const [birthday, setBirthday] = useState('')
    const [avatar, setAvatar] = useState<string | null>(null)
    const [photo, setPhoto] = useState<string | null>(null)
    const [newPhotos, setNewPhotos] = useState<readonly NewPhoto[]>([])
    const [readingSupport, setReadingSupport] = useState(false)
    const [readingSupportTouched, setReadingSupportTouched] = useState(false)
    const [passwordDraft, setPasswordDraft] = useState<PasswordDraft>(EMPTY_PASSWORD_DRAFT)
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const body = profileCreateFrom({ name, birthday, avatar, photo, newPhotos, readingSupport, password: passwordDraft }, currentYear)
    const canSubmit = body !== null && !submitting

    function handleBirthdayChange(value: string): void {
      setBirthday(value)
      if (!readingSupportTouched && value !== '') setReadingSupport(defaultReadingSupport(value, currentYear))
    }

    async function handleSubmit(): Promise<void> {
      if (body === null || submitting) return
      setSubmitting(true)
      setError(null)
      try {
        const profile = await createProfile(body)
        onCreated(profile, body.password ?? null)
      } catch (err) {
        setError(errorMessage(err))
      } finally {
        setSubmitting(false)
      }
    }

    return (
      <div style={{ minHeight: '100%', boxSizing: 'border-box', background: 'var(--surface-app)', display: 'flex', justifyContent: 'center', padding: '56px 24px' }}>
        <div style={{ width: '100%', maxWidth: 560, background: 'var(--surface-default)', border: '1px solid var(--border-subtle)', borderRadius: 32, padding: '44px 40px', boxShadow: 'var(--elevation-600)' }}>
          <h1 style={{ margin: 0, fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 32, lineHeight: 1.1, color: 'var(--fg-primary)', textAlign: 'center' }}>Add a player</h1>
          <div style={{ marginTop: 8, fontSize: 16, color: 'var(--fg-tertiary)', textAlign: 'center' }}>Tell us a bit about them.</div>

          <ProfileFormFields
            today={todayIso}
            name={name}
            onNameChange={setName}
            birthday={birthday}
            onBirthdayChange={handleBirthdayChange}
            avatar={avatar}
            onAvatarChange={(value) => {
              setAvatar(value)
              setPhoto(null)
            }}
            readingSupport={readingSupport}
            onReadingSupportChange={(value) => {
              setReadingSupport(value)
              setReadingSupportTouched(true)
            }}
          />

          <div className="profile-avatar-divider">
            <span>or use a photo</span>
          </div>
          <PhotoCapture
            value={photo}
            onChange={(value) => {
              setPhoto(value)
              if (value !== null) setAvatar(null)
            }}
            onNewPhotosChange={setNewPhotos}
          />

          <ProfilePasswordFields draft={passwordDraft} onChange={setPasswordDraft} />

          {error !== null && (
            <div role="alert" style={{ marginTop: 20, color: '#CD2A20', background: '#FDF2F2', padding: 12, borderRadius: 12 }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 12, marginTop: 32 }}>
            <DenButton label="Cancel" variant="quiet" size="lg" onClick={onCancel} />
            <div style={{ flex: 1 }}>
              <DenButton label={submitting ? 'Creating…' : 'Create profile'} size="lg" full disabled={!canSubmit} onClick={() => void handleSubmit()} />
            </div>
          </div>
        </div>
      </div>
    )
  }
  return CreateProfile
}
