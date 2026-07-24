import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react'
import { TileAssembly, type TileAssemblyItem } from './TileAssembly'

/**
 * Regression test for a real bug: words with a repeated syllable (e.g.
 * "tomato" → to-ma-to) used the syllable text itself as the tile `id`, so
 * both "to" tiles shared one id. Tile ids are used as React list keys and as
 * Set/object keys for placement tracking, so a duplicate id corrupts both —
 * placing one "to" tile made the round unfinishable, since the two tiles
 * became indistinguishable. `answer`/`isCorrect` compare by label, since
 * `TileAssemblyItem.answer` is an array of syllable labels, not tile ids —
 * this must keep working once tile ids stop equalling their labels.
 */

const TOMATO_ITEM: TileAssemblyItem = {
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

function tap(el: HTMLElement) {
  fireEvent.pointerDown(el, { pointerId: 1, clientX: 0, clientY: 0 })
  fireEvent.pointerUp(window, { pointerId: 1, clientX: 0, clientY: 0 })
}

afterEach(() => cleanup())

describe('TileAssembly with a repeated syllable', () => {
  it('checks as correct once both "to" tiles and "ma" are placed in order', async () => {
    const onResult = vi.fn()
    render(<TileAssembly item={TOMATO_ITEM} onResult={onResult} embedded />)
    const tray = within(screen.getByTestId('tile-tray'))

    tap(tray.getAllByRole('button', { name: 'to' })[0])
    tap(tray.getByRole('button', { name: 'ma' }))
    tap(tray.getByRole('button', { name: 'to' }))

    fireEvent.click(screen.getByRole('button', { name: /check it/i }))

    expect(onResult).toHaveBeenCalledWith(expect.objectContaining({ correct: true, value: 'tomato' }))
  })
})
