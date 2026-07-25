import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { HandoffPencil } from './HandoffPencil'

afterEach(() => cleanup())

describe('HandoffPencil', () => {
  it('shows the word to write and calls onWroteIt when confirmed', () => {
    const onWroteIt = vi.fn()
    render(<HandoffPencil word="rabbit" onWroteIt={onWroteIt} />)

    expect(screen.getByText('rabbit')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /i wrote it/i }))

    expect(onWroteIt).toHaveBeenCalled()
  })
})
