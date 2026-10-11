import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { HandoffPencil } from './handoff_pencil.pure.ui.tsx'

afterEach(cleanup)

describe('HandoffPencil', () => {
  it('shows the word to write and calls onWroteIt when confirmed', () => {
    const onWroteIt = vi.fn()
    render(<HandoffPencil word="rabbit" onHearWord={vi.fn()} onWroteIt={onWroteIt} />)
    expect(screen.getByText('rabbit')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'I wrote it' }))
    expect(onWroteIt).toHaveBeenCalled()
  })

  it('asks for the word to be read aloud', () => {
    const onHearWord = vi.fn()
    render(<HandoffPencil word="rabbit" onHearWord={onHearWord} onWroteIt={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Hear the word' }))
    expect(onHearWord).toHaveBeenCalledTimes(1)
  })
})
