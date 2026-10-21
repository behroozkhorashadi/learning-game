import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GameVolumeControl } from './game_volume_control.pure.ui.tsx'

afterEach(cleanup)

describe('GameVolumeControl', () => {
  it('cycles from high to low to muted and back to high', () => {
    const onChange = vi.fn()
    const { rerender } = render(<GameVolumeControl volume={1} onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: 'Volume high. Set volume to low' }))
    expect(onChange).toHaveBeenLastCalledWith(0.5)

    rerender(<GameVolumeControl volume={0.5} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'Volume low. Mute' }))
    expect(onChange).toHaveBeenLastCalledWith(0)

    rerender(<GameVolumeControl volume={0} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'Volume muted. Set volume to high' }))
    expect(onChange).toHaveBeenLastCalledWith(1)
  })
})
