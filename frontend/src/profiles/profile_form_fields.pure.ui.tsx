import type { CSSProperties, ReactElement } from 'react'
import { AVATAR_OPTIONS } from './avatar_options.pure.lib.ts'
import { ageFromBirthday, birthdayBounds, isAgeInRange, yearOf } from './profile_form.pure.lib.ts'

/**
 * Name, birthday, avatar, and reading support: the fields the create and edit
 * screens share, with the same validation bounds. Props only.
 */

const inputStyle: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '14px 16px',
  fontSize: 16,
  borderRadius: 14,
  border: '2px solid var(--border-default)',
  background: 'var(--surface-subtle)',
  color: 'var(--fg-primary)',
  outline: 'none',
}

export interface ProfileFormFieldsProps {
  /** Today as `YYYY-MM-DD`, from the caller's clock. Bounds the birthday and computes the age. */
  readonly today: string
  readonly name: string
  readonly onNameChange: (value: string) => void
  readonly birthday: string
  readonly onBirthdayChange: (value: string) => void
  readonly avatar: string | null
  readonly onAvatarChange: (value: string) => void
  readonly readingSupport: boolean
  readonly onReadingSupportChange: (value: boolean) => void
}

export function ProfileFormFields({
  today,
  name,
  onNameChange,
  birthday,
  onBirthdayChange,
  avatar,
  onAvatarChange,
  readingSupport,
  onReadingSupportChange,
}: ProfileFormFieldsProps): ReactElement {
  const age = ageFromBirthday(birthday, yearOf(today))
  const bounds = birthdayBounds(today)

  return (
    <>
      <label style={{ display: 'block', marginTop: 32 }}>
        <span style={{ display: 'block', marginBottom: 8, fontWeight: 700, color: 'var(--fg-secondary)' }}>Name</span>
        <input
          type="text"
          value={name}
          onChange={(e) => {
            onNameChange(e.target.value)
          }}
          placeholder="What should we call them?"
          style={inputStyle}
        />
      </label>

      <label style={{ display: 'block', marginTop: 24 }}>
        <span style={{ display: 'block', marginBottom: 8, fontWeight: 700, color: 'var(--fg-secondary)' }}>Birthday</span>
        <input
          type="date"
          value={birthday}
          min={bounds.min}
          max={bounds.max}
          onChange={(e) => {
            onBirthdayChange(e.target.value)
          }}
          style={inputStyle}
        />
        {age !== null && !isAgeInRange(age) && <span style={{ display: 'block', marginTop: 8, fontSize: 14, color: '#CD2A20' }}>Please enter a valid birthday.</span>}
        {age !== null && isAgeInRange(age) && (
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
              onClick={() => {
                onAvatarChange(opt.key)
              }}
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
            onReadingSupportChange(e.target.checked)
          }}
          style={{ width: 20, height: 20 }}
        />
        <span style={{ color: 'var(--fg-secondary)' }}>Extra reading help (words read aloud, for early readers)</span>
      </label>
    </>
  )
}
