/** The animal avatars a profile can pick. Mirrors backend/app/models/profile.py's AVATAR_OPTIONS. */
export interface AvatarOption {
  readonly key: string
  readonly emoji: string
}

export const AVATAR_OPTIONS: readonly AvatarOption[] = [
  { key: 'fox', emoji: '🦊' },
  { key: 'owl', emoji: '🦉' },
  { key: 'bear', emoji: '🐻' },
  { key: 'cat', emoji: '🐱' },
  { key: 'panda', emoji: '🐼' },
  { key: 'rabbit', emoji: '🐰' },
]

export function animalAvatar(avatar: string): AvatarOption | null {
  return AVATAR_OPTIONS.find((option) => option.key === avatar) ?? null
}
