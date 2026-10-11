import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DenTile } from './den_tile.pure.ui.tsx'

afterEach(cleanup)

describe('DenTile', () => {
  it('is a button named by its label', () => {
    const onClick = vi.fn()
    render(<DenTile label="cat" onClick={onClick} />)
    fireEvent.click(screen.getByRole('button', { name: 'cat' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('outlines a selected tile', () => {
    render(<DenTile label="cat" selected theme="blue" />)
    const face = screen.getByText('cat')
    expect(face.style.outline).toContain('3px solid')
  })
})
