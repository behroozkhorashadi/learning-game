import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ProfileAvatar } from './profile_avatar.pure.ui.tsx'

afterEach(cleanup)

describe('ProfileAvatar', () => {
  it('shows an animal key as its emoji right away, without requesting art', () => {
    const { container } = render(<ProfileAvatar avatar="fox" name="Nora" />)
    expect(container.textContent).toBe('🦊')
    expect(container.querySelector('img')).toBeNull()
  })

  it('shows a saved photo as an image', () => {
    const { container } = render(<ProfileAvatar avatar="/static/profile-avatars/a.jpg" name="Nora" />)
    expect(container.querySelector('img')?.getAttribute('src')).toBe('/static/profile-avatars/a.jpg')
  })

  it('falls back to the initial when an image fails, and retries when the avatar changes', () => {
    const { container, rerender } = render(<ProfileAvatar avatar="rami" name="Rami" />)
    const img = container.querySelector('img')
    expect(img?.getAttribute('src')).toBe('/images/avatars/rami.png')
    if (img === null) throw new Error('expected an <img>')

    fireEvent.error(img)
    expect(container.textContent).toBe('R')

    rerender(<ProfileAvatar avatar="/static/profile-avatars/new.jpg" name="Rami" />)
    expect(container.querySelector('img')?.getAttribute('src')).toBe('/static/profile-avatars/new.jpg')
  })
})
