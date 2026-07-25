import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { RatingPrompt } from './RatingPrompt'

afterEach(() => cleanup())

describe('RatingPrompt', () => {
  it('reports the tapped star and shows a thank-you caption', () => {
    const onRate = vi.fn()
    const onDismiss = vi.fn()
    render(<RatingPrompt onRate={onRate} onDismiss={onDismiss} />)

    fireEvent.click(screen.getByRole('button', { name: '4 stars' }))

    expect(onRate).toHaveBeenCalledWith(4)
    expect(screen.getByText('Glad you liked it')).toBeTruthy()
    expect(onDismiss).not.toHaveBeenCalled()
  })

  it('dismisses without rating when "Not now" is clicked', () => {
    const onRate = vi.fn()
    const onDismiss = vi.fn()
    render(<RatingPrompt onRate={onRate} onDismiss={onDismiss} />)

    fireEvent.click(screen.getByRole('button', { name: /not now/i }))

    expect(onDismiss).toHaveBeenCalled()
    expect(onRate).not.toHaveBeenCalled()
  })
})
