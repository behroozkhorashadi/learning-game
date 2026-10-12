import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { HordeStart } from './horde_start.pure.ui.tsx'

afterEach(cleanup)

describe('HordeStart', () => {
  it('explains the game, reads it aloud, and starts', () => {
    const onStart = vi.fn()
    const onHearInstructions = vi.fn()
    render(<HordeStart shop={<p>the shop</p>} starting={false} bestMs={0} onHearInstructions={onHearInstructions} onStart={onStart} onOpenStudio={vi.fn()} onBack={vi.fn()} />)
    expect(screen.getByRole('heading', { name: 'Zombie Horde' })).toBeTruthy()
    expect(screen.getByText('the shop')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Hear how to play' }))
    fireEvent.click(screen.getByRole('button', { name: 'Start' }))
    expect(onHearInstructions).toHaveBeenCalledTimes(1)
    expect(onStart).toHaveBeenCalledTimes(1)
  })

  it('shows the personal best to beat, once there is one', () => {
    render(<HordeStart shop={null} starting={false} bestMs={84_500} onHearInstructions={vi.fn()} onStart={vi.fn()} onOpenStudio={null} onBack={vi.fn()} />)
    expect(screen.getByText('Your best: 1:24', { exact: false })).toBeTruthy()
    cleanup()
    render(<HordeStart shop={null} starting={false} bestMs={0} onHearInstructions={vi.fn()} onStart={vi.fn()} onOpenStudio={null} onBack={vi.fn()} />)
    expect(screen.queryByText(/Your best:/)).toBeNull()
  })

  it('holds Start while the round loads', () => {
    const onStart = vi.fn()
    render(<HordeStart shop={null} starting bestMs={0} onHearInstructions={vi.fn()} onStart={onStart} onOpenStudio={vi.fn()} onBack={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Loading…' }))
    expect(onStart).not.toHaveBeenCalled()
  })

  it('opens the art studio, or holds it until the armory has loaded', () => {
    const onOpenStudio = vi.fn()
    render(<HordeStart shop={null} starting={false} bestMs={0} onHearInstructions={vi.fn()} onStart={vi.fn()} onOpenStudio={onOpenStudio} onBack={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Open studio' }))
    expect(onOpenStudio).toHaveBeenCalledTimes(1)
    cleanup()
    render(<HordeStart shop={null} starting={false} bestMs={0} onHearInstructions={vi.fn()} onStart={vi.fn()} onOpenStudio={null} onBack={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Open studio' }))
    expect(onOpenStudio).toHaveBeenCalledTimes(1)
  })
})
