import { describe, expect, it } from 'vitest'
import { profileListSchema } from './profiles_schema.pure.lib.ts'

describe('profileListSchema', () => {
  it('fills the server-side defaults', () => {
    expect(profileListSchema.parse([{ id: 1, name: 'A', avatar: 'fox', birth_year: 2020 }])).toEqual([
      { id: 1, name: 'A', avatar: 'fox', birth_year: 2020, reading_support: false, has_password: false, created_at: null, parent_id: null },
    ])
  })

  it('requires an id (a listed profile is always a stored row)', () => {
    expect(profileListSchema.safeParse([{ id: null, name: 'A', avatar: 'fox', birth_year: 2020 }]).success).toBe(false)
  })

  it('rejects wrong types', () => {
    expect(profileListSchema.safeParse([{ id: 1, name: 'A', avatar: 'fox', birth_year: '2020' }]).success).toBe(false)
  })
})
