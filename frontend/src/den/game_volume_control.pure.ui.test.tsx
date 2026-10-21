import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GameVolumeControl } from './game_volume_control.pure.ui.tsx'

afterEach(cleanup)

describe('GameVolumeControl', () => {
  it('opens an explicit chooser, marks the current level, and closes after selection', () => {
    const onChange = vi.fn()
    render(<GameVolumeControl volume={1} onChange={onChange} />)

    expect(screen.queryByRole('group', { name: 'Volume options' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Volume high. Choose volume' }))
    expect(screen.getByRole('button', { name: 'High volume (selected)' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Low volume' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Muted volume' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Low volume' }))
    expect(onChange).toHaveBeenLastCalledWith(0.5)
    expect(screen.queryByRole('group', { name: 'Volume options' })).toBeNull()
  })
})
