import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { WordPicture } from './word_picture.pure.ui.tsx'

afterEach(cleanup)

describe('WordPicture', () => {
  it("shows the word's picture, or a placeholder when it has none", () => {
    render(<WordPicture word="rabbit" />)
    const img = screen.getByRole('img', { name: 'rabbit' })
    expect(img.getAttribute('src')).toBe('/images/words/rabbit.png')
    fireEvent.error(img)
    expect(screen.getByText('No picture yet')).toBeTruthy()
  })
})
