import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { IllustrationArt } from './illustration_art.pure.ui.tsx'

afterEach(cleanup)

describe('IllustrationArt', () => {
  it('shows the image, and the style swatch when it is missing or broken', () => {
    render(<IllustrationArt imageUrl="/static/a.png" style="chalk" label="Hero" />)
    fireEvent.error(screen.getByRole('img', { name: 'Hero' }))
    expect(screen.getByRole('img', { name: 'Hero' }).tagName).toBe('DIV')
    cleanup()
    render(<IllustrationArt imageUrl="" style="storybook" label="Moment" />)
    expect(screen.getByText('Moment')).toBeTruthy()
  })
})
