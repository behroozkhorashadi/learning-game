import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TileBoard, type TileBoardProps } from './tile_board.pure.ui.tsx'
import type { BoardItem } from './tile_placement.pure.lib.ts'

/**
 * Includes the regression for a real bug: words with a repeated syllable
 * ("tomato" → to-ma-to) once used the syllable text as the tile id, so both
 * "to" tiles were indistinguishable and the round couldn't be finished.
 * Placement is tracked by id; correctness compares labels.
 */
const TOMATO: BoardItem = {
  kind: 'word',
  instruction: 'Put the sounds in order to build the word',
  spoken: 'tomato',
  slots: 3,
  answer: ['to', 'ma', 'to'],
  tiles: [
    { id: 'to-0', label: 'to' },
    { id: 'ma-1', label: 'ma' },
    { id: 'to-2', label: 'to' },
  ],
}

afterEach(cleanup)

function renderBoard(overrides: Partial<TileBoardProps> = {}) {
  const props = { item: TOMATO, onResult: vi.fn(), onSpeak: vi.fn(), embedded: true, ...overrides }
  render(<TileBoard {...props} />)
  return props
}

const tray = () => within(screen.getByRole('group', { name: 'Sound tiles' }))
const slot = (n: number) => screen.getByRole('group', { name: new RegExp(`^Slot ${String(n)}`) })

/** A press-and-release without movement is a tap. */
function tap(el: HTMLElement): void {
  fireEvent.pointerDown(el, { pointerId: 1, clientX: 0, clientY: 0 })
  fireEvent.pointerUp(el, { pointerId: 1, clientX: 0, clientY: 0 })
}

function firstTile(name: string): HTMLElement {
  const tile = tray().getAllByRole('button', { name })[0]
  if (tile === undefined) throw new Error(`no ${name} tile in the tray`)
  return tile
}

describe('TileBoard', () => {
  it('checks as correct once both "to" tiles and "ma" are placed in order', () => {
    const { onResult } = renderBoard()
    tap(firstTile('to'))
    tap(firstTile('ma'))
    tap(firstTile('to'))
    fireEvent.click(screen.getByRole('button', { name: /Check it/ }))
    expect(onResult).toHaveBeenCalledWith({ kind: 'word', correct: true, placement: ['to-0', 'ma-1', 'to-2'], value: 'tomato', hintsUsed: 0 })
    expect(screen.getByText('You built it!')).toBeTruthy()
  })

  it('a wrong order says try again, which keeps only the tiles in the right place', () => {
    const { onResult } = renderBoard()
    tap(firstTile('ma'))
    tap(firstTile('to'))
    tap(firstTile('to'))
    fireEvent.click(screen.getByRole('button', { name: /Check it/ }))
    expect(onResult).toHaveBeenCalledWith(expect.objectContaining({ correct: false, value: 'matoto' }))
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(slot(1).getAttribute('aria-label')).toBe('Slot 1, empty')
    expect(slot(3).getAttribute('aria-label')).toBe('Slot 3: to')
  })

  it('tapping a placed tile sends it back, and Undo removes the last placed', () => {
    renderBoard()
    tap(firstTile('to'))
    tap(firstTile('ma'))
    const placedMa = within(slot(2)).getByRole('button', { name: 'ma' })
    tap(placedMa)
    expect(slot(2).getAttribute('aria-label')).toBe('Slot 2, empty')
    fireEvent.click(screen.getByRole('button', { name: /Undo/ }))
    expect(slot(1).getAttribute('aria-label')).toBe('Slot 1, empty')
    expect(screen.getByRole('button', { name: /Undo/ })).toHaveProperty('disabled', true)
  })

  it('a hint speaks the word, nudges the first empty slot, and counts toward the result', () => {
    const { onSpeak, onResult } = renderBoard()
    fireEvent.click(screen.getByRole('button', { name: 'Hint' }))
    expect(onSpeak).toHaveBeenCalledWith('tomato')
    fireEvent.click(screen.getByRole('button', { name: /Which sound comes first/ }))
    expect(onSpeak).toHaveBeenCalledTimes(2)
    for (const name of ['to', 'ma', 'to']) tap(firstTile(name))
    fireEvent.click(screen.getByRole('button', { name: /Check it/ }))
    expect(onResult).toHaveBeenCalledWith(expect.objectContaining({ hintsUsed: 1 }))
  })

  it('Check is disabled until every slot is filled', () => {
    renderBoard()
    tap(firstTile('to'))
    expect(screen.getByRole('button', { name: /Check it/ })).toHaveProperty('disabled', true)
  })

  it('drags a tile onto a slot by its position', () => {
    renderBoard()
    const target = slot(3)
    target.getBoundingClientRect = () => DOMRect.fromRect({ x: 300, y: 0, width: 90, height: 90 })
    const tile = firstTile('ma')
    fireEvent.pointerDown(tile, { pointerId: 1, clientX: 10, clientY: 10 })
    fireEvent.pointerMove(tile, { pointerId: 1, clientX: 340, clientY: 40 })
    expect(target.style.background).toBe('rgb(234, 240, 255)')
    fireEvent.pointerUp(tile, { pointerId: 1, clientX: 340, clientY: 40 })
    expect(target.getAttribute('aria-label')).toBe('Slot 3: ma')
  })

  it('"Play again" after a correct answer hands over to the caller when it can load a new item', () => {
    const onPlayAgain = vi.fn()
    renderBoard({ onPlayAgain })
    for (const name of ['to', 'ma', 'to']) tap(firstTile(name))
    fireEvent.click(screen.getByRole('button', { name: /Check it/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Play again' }))
    expect(onPlayAgain).toHaveBeenCalled()
  })

  it('"Play again" without a caller handler resets the same item', () => {
    renderBoard()
    for (const name of ['to', 'ma', 'to']) tap(firstTile(name))
    fireEvent.click(screen.getByRole('button', { name: /Check it/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Play again' }))
    expect(tray().getAllByRole('button')).toHaveLength(3)
  })

  it('outside a game it shows the instruction and a Hear it button', () => {
    const { onSpeak } = renderBoard({ embedded: false })
    expect(screen.getByText('Put the sounds in order to build the word')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Hear it' }))
    expect(onSpeak).toHaveBeenCalledWith('tomato')
  })
})
