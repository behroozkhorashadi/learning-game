import { describe, expect, it } from 'vitest'
import { newPhotosPayload, remixLabel } from './profile_photo_state.pure.lib.ts'

describe('remixLabel', () => {
  it('names a remix by its look, its idea, or both', () => {
    expect(remixLabel('wizard', '')).toBe('Wizard')
    expect(remixLabel(null, 'rainbow hair')).toBe('rainbow hair')
    expect(remixLabel('space', 'rainbow hair')).toBe('Space explorer + rainbow hair')
  })
})

describe('newPhotosPayload', () => {
  it('sends every new photo and marks only the picked one as the avatar', () => {
    const photos = [
      { src: 'data:a', label: 'Photo' },
      { src: 'data:b', label: 'Wizard' },
    ]
    expect(newPhotosPayload(photos, 'data:b')).toEqual([
      { image_data_url: 'data:a', label: 'Photo', use_as_avatar: false },
      { image_data_url: 'data:b', label: 'Wizard', use_as_avatar: true },
    ])
    expect(newPhotosPayload(photos, '/static/saved.jpg').map((p) => p.use_as_avatar)).toEqual([false, false])
  })
})
