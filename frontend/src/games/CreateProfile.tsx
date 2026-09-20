import { useState } from 'react'
import { DenButton } from '../components/den/DenButton'
import { ProfileFormFields, MIN_AGE, MAX_AGE, READING_SUPPORT_DEFAULT_MAX_AGE, birthYearOf, ageOf } from '../components/ProfileFormFields'
import type { Profile, ProfileCreate } from '../types/generated'

/**
 * Create-profile screen — reached from a "+ Add a player" tile on
 * ProfilePicker. Collects everything `ProfileCreate` needs: a name, a
 * birthday (only the year is persisted — see `Profile`'s own docstring on
 * why year-not-band, and `backend/app/models/profile.py`'s `AVATAR_OPTIONS`/
 * `MIN_AGE`/`MAX_AGE` for the avatar list and age bounds this mirrors), and
 * an avatar. `reading_support` defaults from age (PRD §8: "on by default for
 * the 6 band") but stays a plain checkbox the parent can override either way.
 */

const CURRENT_YEAR = new Date().getFullYear()

interface Props {
  onCreated: (profile: Profile) => void
  onCancel: () => void
}

export function CreateProfile({ onCreated, onCancel }: Props) {
  const [name, setName] = useState('')
  const [birthday, setBirthday] = useState('')
  const [avatar, setAvatar] = useState<string | null>(null)
  const [readingSupport, setReadingSupport] = useState(false)
  const [readingSupportTouched, setReadingSupportTouched] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const birthYear = birthday ? birthYearOf(birthday) : null
  const age = birthYear != null ? ageOf(birthYear) : null
  const ageInRange = age != null && age >= MIN_AGE && age <= MAX_AGE
  const canSubmit = name.trim().length > 0 && ageInRange && avatar != null && !submitting

  function handleBirthdayChange(value: string) {
    setBirthday(value)
    if (!readingSupportTouched && value) {
      setReadingSupport(birthYearOf(value) >= CURRENT_YEAR - READING_SUPPORT_DEFAULT_MAX_AGE)
    }
  }

  async function handleSubmit() {
    if (!canSubmit || birthYear == null || avatar == null) return
    setSubmitting(true)
    setError(null)
    const payload: ProfileCreate = { name: name.trim(), avatar, birth_year: birthYear, reading_support: readingSupport }
    try {
      const res = await fetch('/api/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.detail ?? `POST /api/profiles -> ${res.status}`)
      }
      const profile: Profile = await res.json()
      onCreated(profile)
    } catch (err) {
      setError(String(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ minHeight: '100%', boxSizing: 'border-box', background: 'var(--surface-app)', display: 'flex', justifyContent: 'center', padding: '56px 24px' }}>
      <div style={{ width: '100%', maxWidth: 560, background: 'var(--surface-default)', border: '1px solid var(--border-subtle)', borderRadius: 32, padding: '44px 40px', boxShadow: 'var(--elevation-600)' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 32, lineHeight: 1.1, color: 'var(--fg-primary)', textAlign: 'center' }}>
          Add a player
        </div>
        <div style={{ marginTop: 8, fontSize: 16, color: 'var(--fg-tertiary)', textAlign: 'center' }}>Tell us a bit about them.</div>

        <ProfileFormFields
          name={name}
          onNameChange={setName}
          birthday={birthday}
          onBirthdayChange={handleBirthdayChange}
          avatar={avatar}
          onAvatarChange={setAvatar}
          readingSupport={readingSupport}
          onReadingSupportChange={(value) => {
            setReadingSupport(value)
            setReadingSupportTouched(true)
          }}
        />

        {error && <div style={{ marginTop: 20, color: '#CD2A20', background: '#FDF2F2', padding: 12, borderRadius: 12 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 12, marginTop: 32 }}>
          <DenButton label="Cancel" variant="quiet" size="lg" onClick={onCancel} />
          <div style={{ flex: 1 }}>
            <DenButton label={submitting ? 'Creating…' : 'Create profile'} size="lg" full disabled={!canSubmit} onClick={handleSubmit} />
          </div>
        </div>
      </div>
    </div>
  )
}
