import { describe, expect, it } from 'vitest'
import { AVATAR_OPTIONS, animalAvatar } from './avatar_options.pure.lib.ts'

describe('animalAvatar', () => {
  it('finds an animal by key', () => {
    expect(animalAvatar('owl')).toEqual({ key: 'owl', emoji: '🦉' })
  })

  it('is null for photos and other keys', () => {
    expect(animalAvatar('/static/a.jpg')).toBeNull()
    expect(animalAvatar('rami')).toBeNull()
  })

  it('has unique keys', () => {
    expect(new Set(AVATAR_OPTIONS.map((o) => o.key)).size).toBe(AVATAR_OPTIONS.length)
  })
})
