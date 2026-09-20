// Shared by CreateProfile.tsx (new player) and AdminPanel.tsx (edit player) —
// same fields, same validation bounds, so the two forms can't drift apart.
// Mirrors backend/app/models/profile.py's AVATAR_OPTIONS/MIN_AGE/MAX_AGE by
// hand, since these are sanity bounds rather than values expected to change
// independently on either side.
export const AVATAR_OPTIONS: { key: string; emoji: string }[] = [
  { key: 'fox', emoji: '🦊' },
  { key: 'owl', emoji: '🦉' },
  { key: 'bear', emoji: '🐻' },
  { key: 'cat', emoji: '🐱' },
  { key: 'panda', emoji: '🐼' },
  { key: 'rabbit', emoji: '🐰' },
]

export const MIN_AGE = 3
export const MAX_AGE = 14
export const READING_SUPPORT_DEFAULT_MAX_AGE = 6

const TODAY = new Date()
export const MAX_BIRTHDAY = TODAY.toISOString().slice(0, 10)
export const MIN_BIRTHDAY = `${TODAY.getFullYear() - MAX_AGE - 1}-01-01`

export function birthYearOf(birthday: string): number {
  return Number(birthday.split('-')[0])
}

export function ageOf(birthYear: number): number {
  return TODAY.getFullYear() - birthYear
}

const inputStyle = {
  width: '100%',
  boxSizing: 'border-box' as const,
  padding: '14px 16px',
  fontSize: 16,
  borderRadius: 14,
  border: '2px solid var(--border-default)',
  background: 'var(--surface-subtle)',
  color: 'var(--fg-primary)',
  outline: 'none',
}

interface Props {
  name: string
  onNameChange: (value: string) => void
  birthday: string
  onBirthdayChange: (value: string) => void
  avatar: string | null
  onAvatarChange: (value: string) => void
  readingSupport: boolean
  onReadingSupportChange: (value: boolean) => void
}

export function ProfileFormFields({
  name,
  onNameChange,
  birthday,
  onBirthdayChange,
  avatar,
  onAvatarChange,
  readingSupport,
  onReadingSupportChange,
}: Props) {
  const birthYear = birthday ? birthYearOf(birthday) : null
  const age = birthYear != null ? ageOf(birthYear) : null
  const ageInRange = age != null && age >= MIN_AGE && age <= MAX_AGE

  return (
    <>
      <label style={{ display: 'block', marginTop: 32 }}>
        <span style={{ display: 'block', marginBottom: 8, fontWeight: 700, color: 'var(--fg-secondary)' }}>Name</span>
        <input type="text" value={name} onChange={(e) => onNameChange(e.target.value)} placeholder="What should we call them?" style={inputStyle} />
      </label>

      <label style={{ display: 'block', marginTop: 24 }}>
        <span style={{ display: 'block', marginBottom: 8, fontWeight: 700, color: 'var(--fg-secondary)' }}>Birthday</span>
        <input
          type="date"
          value={birthday}
          min={MIN_BIRTHDAY}
          max={MAX_BIRTHDAY}
          onChange={(e) => onBirthdayChange(e.target.value)}
          style={inputStyle}
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
              onClick={() => onAvatarChange(opt.key)}
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
          onChange={(e) => onReadingSupportChange(e.target.checked)}
          style={{ width: 20, height: 20 }}
        />
        <span style={{ color: 'var(--fg-secondary)' }}>Extra reading help (words read aloud, for early readers)</span>
      </label>
    </>
  )
}
