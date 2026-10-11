import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { ParentVerify } from './parent_verify.pure.ui.tsx'

afterEach(cleanup)

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

  it('clears a wrong PIN once the shake ends, so it can be retyped', () => {
    render(<ParentVerify word="rabbit" onResult={vi.fn()} />)
    pressPin(['9', '9', '9', '9'])
    pressPin(['1']) // ignored: the four dots are full until the shake ends
    const dots = screen.getByRole('img', { name: /PIN digits/ })
    expect(dots.getAttribute('aria-label')).toBe('PIN digits entered: 4 of 4')
    fireEvent.animationEnd(dots)
    expect(dots.getAttribute('aria-label')).toBe('PIN digits entered: 0 of 4')
    pressPin(['1', '2', '3', '4'])
    expect(screen.getByText('Did they write it correctly?')).toBeTruthy()
  })

  it('Delete and Clear edit the entry', () => {
    render(<ParentVerify word="rabbit" onResult={vi.fn()} />)
    pressPin(['1', '2', '3'])
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(screen.getByRole('img', { name: 'PIN digits entered: 2 of 4' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }))
    expect(screen.getByRole('img', { name: 'PIN digits entered: 0 of 4' })).toBeTruthy()
  })

  it('reports "Not yet" and can lock again', () => {
    const onResult = vi.fn()
    render(<ParentVerify word="rabbit" onResult={onResult} />)
    pressPin(['1', '2', '3', '4'])
    fireEvent.click(screen.getByRole('button', { name: 'Not yet' }))
    expect(onResult).toHaveBeenCalledWith(false)
    fireEvent.click(screen.getByRole('button', { name: 'Lock again' }))
    expect(screen.getByText('Grown-up check')).toBeTruthy()
  })
})
