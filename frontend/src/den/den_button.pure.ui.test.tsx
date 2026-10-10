import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DenButton } from './den_button.pure.ui.tsx'

afterEach(cleanup)

describe('DenButton', () => {
  it('is a button named by its label', () => {
    const onClick = vi.fn()
    render(<DenButton label="Play" onClick={onClick} />)
    fireEvent.click(screen.getByRole('button', { name: 'Play' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('keeps an accessible name when it shows only an icon', () => {
    render(<DenButton label="Back" iconOnly iconPaths={['M0 0L1 1']} />)
    const button = screen.getByRole('button', { name: 'Back' })
    expect(button.textContent).toBe('')
    expect(button.getAttribute('title')).toBe('Back')
  })

  it('prefers an explicit ariaLabel', () => {
    render(<DenButton label="X" iconOnly ariaLabel="Close dialog" />)
    expect(screen.getByRole('button', { name: 'Close dialog' })).toBeTruthy()
  })

  it('ignores clicks while disabled', () => {
    const onClick = vi.fn()
    render(<DenButton label="Play" disabled onClick={onClick} />)
    fireEvent.click(screen.getByRole('button', { name: 'Play' }))
    expect(onClick).not.toHaveBeenCalled()
  })

  it('draws one path per icon path', () => {
    render(<DenButton label="Go" iconPaths={['M0 0', { d: 'M1 1', fill: 'red' }]} />)
    expect(screen.getByRole('button', { name: 'Go' }).querySelectorAll('path')).toHaveLength(2)
  })
})
