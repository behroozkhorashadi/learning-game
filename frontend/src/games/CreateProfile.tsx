import { useState } from 'react'
import { DenButton } from '../components/den/DenButton'
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

// Mirrors backend/app/models/profile.py's AVATAR_OPTIONS. None has real art
// yet (only the two hardcoded seed profiles do), so each renders as an emoji
// here and falls back to the profile's initial letter everywhere else via
// ProfilePicker's `ProfileAvatar` — see that component's onError handling.
const AVATAR_OPTIONS: { key: string; emoji: string }[] = [
  { key: 'fox', emoji: '🦊' },
  { key: 'owl', emoji: '🦉' },
  { key: 'bear', emoji: '🐻' },
  { key: 'cat', emoji: '🐱' },
  { key: 'panda', emoji: '🐼' },
  { key: 'rabbit', emoji: '🐰' },
]

// Mirrors backend/app/models/profile.py's MIN_AGE/MAX_AGE — kept in sync by
// hand since these are sanity bounds, not a value either side is expected to
// change independently.
const MIN_AGE = 3
const MAX_AGE = 14
const READING_SUPPORT_DEFAULT_MAX_AGE = 6

const TODAY = new Date()
const MAX_BIRTHDAY = TODAY.toISOString().slice(0, 10)
const MIN_BIRTHDAY = `${TODAY.getFullYear() - MAX_AGE - 1}-01-01`

function birthYearOf(birthday: string): number {
  return Number(birthday.split('-')[0])
}

function ageOf(birthYear: number): number {
  return TODAY.getFullYear() - birthYear
}

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
      setReadingSupport(birthYearOf(value) >= TODAY.getFullYear() - READING_SUPPORT_DEFAULT_MAX_AGE)
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

        <label style={{ display: 'block', marginTop: 32 }}>
          <span style={{ display: 'block', marginBottom: 8, fontWeight: 700, color: 'var(--fg-secondary)' }}>Name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="What should we call them?"
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '14px 16px',
              fontSize: 16,
              borderRadius: 14,
              border: '2px solid var(--border-default)',
              background: 'var(--surface-subtle)',
              color: 'var(--fg-primary)',
              outline: 'none',
            }}
          />
        </label>

        <label style={{ display: 'block', marginTop: 24 }}>
          <span style={{ display: 'block', marginBottom: 8, fontWeight: 700, color: 'var(--fg-secondary)' }}>Birthday</span>
          <input
            type="date"
            value={birthday}
            min={MIN_BIRTHDAY}
            max={MAX_BIRTHDAY}
            onChange={(e) => handleBirthdayChange(e.target.value)}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '14px 16px',
              fontSize: 16,
              borderRadius: 14,
              border: '2px solid var(--border-default)',
              background: 'var(--surface-subtle)',
              color: 'var(--fg-primary)',
              outline: 'none',
            }}
          />
          {birthday && !ageInRange && (
            <span style={{ display: 'block', marginTop: 8, fontSize: 14, color: '#CD2A20' }}>
              {`This game is built for ages ${MIN_AGE}–${MAX_AGE}.`}
            </span>
          )}
          {age != null && ageInRange && (
            <span style={{ display: 'block', marginTop: 8, fontSize: 14, color: 'var(--fg-tertiary)' }}>That makes them {age} years old.</span>
          )}
        </label>

        <div style={{ marginTop: 24 }}>
          <span style={{ display: 'block', marginBottom: 8, fontWeight: 700, color: 'var(--fg-secondary)' }}>Avatar</span>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {AVATAR_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                type="button"
                aria-label={`Choose the ${opt.key} avatar`}
                aria-pressed={avatar === opt.key}
                onClick={() => setAvatar(opt.key)}
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 9999,
                  fontSize: 26,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  background: avatar === opt.key ? 'var(--blue-100)' : 'var(--surface-subtle)',
                  border: avatar === opt.key ? '2px solid var(--fg-brand)' : '2px solid var(--border-default)',
                }}
              >
                {opt.emoji}
              </button>
            ))}
          </div>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 24, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={readingSupport}
            onChange={(e) => {
              setReadingSupport(e.target.checked)
              setReadingSupportTouched(true)
            }}
            style={{ width: 20, height: 20 }}
          />
          <span style={{ color: 'var(--fg-secondary)' }}>Extra reading help (words read aloud, for early readers)</span>
        </label>

        {error && (
          <div style={{ marginTop: 20, color: '#CD2A20', background: '#FDF2F2', padding: 12, borderRadius: 12 }}>{error}</div>
        )}

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
