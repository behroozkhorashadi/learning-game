import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { HordeStart } from './horde_start.pure.ui.tsx'

const NO_BESTS = { easy: 0, medium: 0, hard: 0, insane: 0 }

afterEach(cleanup)

describe('HordeStart', () => {
  it('explains the game, reads it aloud, and starts', () => {
    const onStart = vi.fn()
    const onHearInstructions = vi.fn()
    render(<HordeStart shop={<p>the shop</p>} starting={false} difficulty="medium" onChooseDifficulty={vi.fn()} bestMs={NO_BESTS} readingInstructions={false} onHearInstructions={onHearInstructions} onStart={onStart} onOpenStudio={vi.fn()} onBack={vi.fn()} />)
    expect(screen.getByRole('heading', { name: 'Zombie Horde' })).toBeTruthy()
    expect(screen.getByText('the shop')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Hear how to play' }))
    fireEvent.click(screen.getByRole('button', { name: 'Start' }))
    expect(onHearInstructions).toHaveBeenCalledTimes(1)
    expect(onStart).toHaveBeenCalledTimes(1)
  })

  it('turns the speaker into a stop button while reading', () => {
    const onHearInstructions = vi.fn()
    render(<HordeStart shop={null} starting={false} difficulty="medium" onChooseDifficulty={vi.fn()} bestMs={NO_BESTS} readingInstructions onHearInstructions={onHearInstructions} onStart={vi.fn()} onOpenStudio={null} onBack={vi.fn()} />)
    expect(screen.queryByRole('button', { name: 'Hear how to play' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Stop reading' }))
    expect(onHearInstructions).toHaveBeenCalledTimes(1)
  })

  it('shows the personal best to beat, once there is one', () => {
    render(<HordeStart shop={null} starting={false} difficulty="medium" onChooseDifficulty={vi.fn()} bestMs={{ ...NO_BESTS, medium: 84_500 }} readingInstructions={false} onHearInstructions={vi.fn()} onStart={vi.fn()} onOpenStudio={null} onBack={vi.fn()} />)
    expect(screen.getByText('Your best on Medium: 1:24', { exact: false })).toBeTruthy()
    cleanup()
    render(<HordeStart shop={null} starting={false} difficulty="medium" onChooseDifficulty={vi.fn()} bestMs={NO_BESTS} readingInstructions={false} onHearInstructions={vi.fn()} onStart={vi.fn()} onOpenStudio={null} onBack={vi.fn()} />)
    expect(screen.queryByText(/Your best/)).toBeNull()
  })

  it('picks a difficulty, and shows that difficulty\'s best', () => {
    const onChooseDifficulty = vi.fn()
    render(<HordeStart shop={null} starting={false} difficulty="hard" onChooseDifficulty={onChooseDifficulty} bestMs={{ easy: 130_000, medium: 84_500, hard: 62_000, insane: 0 }} readingInstructions={false} onHearInstructions={vi.fn()} onStart={vi.fn()} onOpenStudio={null} onBack={vi.fn()} />)
    const group = screen.getByRole('group', { name: 'Difficulty' })
    expect(within(group).getByRole('button', { name: /^Hard/ }).getAttribute('aria-pressed')).toBe('true')
    expect(within(group).getByRole('button', { name: /^Easy/ }).getAttribute('aria-pressed')).toBe('false')
    expect(screen.getByText('Your best on Hard: 1:02', { exact: false })).toBeTruthy()
    fireEvent.click(within(group).getByRole('button', { name: /^Easy/ }))
    expect(onChooseDifficulty).toHaveBeenCalledWith('easy')
  })

  it('offers Insane with its locked-gear rules', () => {
    render(<HordeStart shop={null} starting={false} difficulty="insane" onChooseDifficulty={vi.fn()} bestMs={NO_BESTS} readingInstructions={false} onHearInstructions={vi.fn()} onStart={vi.fn()} onOpenStudio={null} onBack={vi.fn()} />)
    expect(screen.getByRole('button', { name: /^Insane/ }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByText(/Base blaster, standard rounds, no grenades or armor powers/)).toBeTruthy()
  })

  it('holds Start while the round loads', () => {
    const onStart = vi.fn()
    render(<HordeStart shop={null} starting difficulty="medium" onChooseDifficulty={vi.fn()} bestMs={NO_BESTS} readingInstructions={false} onHearInstructions={vi.fn()} onStart={onStart} onOpenStudio={vi.fn()} onBack={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Loading…' }))
    expect(onStart).not.toHaveBeenCalled()
  })

  it('opens the art studio, or holds it until the armory has loaded', () => {
    const onOpenStudio = vi.fn()
    render(<HordeStart shop={null} starting={false} difficulty="medium" onChooseDifficulty={vi.fn()} bestMs={NO_BESTS} readingInstructions={false} onHearInstructions={vi.fn()} onStart={vi.fn()} onOpenStudio={onOpenStudio} onBack={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Open studio' }))
    expect(onOpenStudio).toHaveBeenCalledTimes(1)
    cleanup()
    render(<HordeStart shop={null} starting={false} difficulty="medium" onChooseDifficulty={vi.fn()} bestMs={NO_BESTS} readingInstructions={false} onHearInstructions={vi.fn()} onStart={vi.fn()} onOpenStudio={null} onBack={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Open studio' }))
    expect(onOpenStudio).toHaveBeenCalledTimes(1)
  })
})
