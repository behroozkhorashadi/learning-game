import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Cover } from './cover.pure.ui.tsx'
import { LIGHTHOUSE, illustration } from './library_fixtures.test.lib.ts'

afterEach(cleanup)

describe('Cover', () => {
  it('shows the hero image, falling back to the style swatch and label when it fails', () => {
    const { container } = render(<Cover piece={LIGHTHOUSE} illustrations={[illustration('p1', { image_url: '/static/h.png' })]} label="Cover" />)
    const img = container.querySelector('img')
    if (img === null) throw new Error('expected the hero image')
    expect(img.getAttribute('src')).toBe('/static/h.png')
    fireEvent.error(img)
    expect(screen.getByText('Cover')).toBeTruthy()
  })

  it('hides the label when asked', () => {
    const { container } = render(<Cover piece={LIGHTHOUSE} illustrations={[]} label="Cover" showLabel={false} />)
    expect(container.textContent).toBe('')
  })
})
