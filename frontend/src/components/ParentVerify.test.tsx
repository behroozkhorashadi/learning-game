import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { ParentVerify } from './ParentVerify'

afterEach(() => cleanup())

function pressPin(digits: string[]) {
  for (const digit of digits) {
    fireEvent.click(screen.getByRole('button', { name: digit }))
  }
}

describe('ParentVerify', () => {
  it('shows an error and stays locked on a wrong PIN', () => {
    render(<ParentVerify word="rabbit" onResult={vi.fn()} />)

    pressPin(['9', '9', '9', '9'])

    expect(screen.getByText(/wrong pin/i)).toBeTruthy()
    expect(screen.queryByText('Did they write it correctly?')).toBeNull()
  })

  it('unlocks on the correct PIN and reports the parent judgment', () => {
    const onResult = vi.fn()
    render(<ParentVerify word="rabbit" onResult={onResult} />)

    pressPin(['1', '2', '3', '4'])

    expect(screen.getByText('Did they write it correctly?')).toBeTruthy()
    expect(screen.getByText('rabbit')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /correct/i }))

    expect(onResult).toHaveBeenCalledWith(true)
  })

  it('uses the kid name in the prompt when provided', () => {
    render(<ParentVerify word="rabbit" kidName="Mia" onResult={vi.fn()} />)

    pressPin(['1', '2', '3', '4'])

    expect(screen.getByText('Did Mia write it correctly?')).toBeTruthy()
  })
})
