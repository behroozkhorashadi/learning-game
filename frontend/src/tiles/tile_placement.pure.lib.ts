/**
 * The rules of the tile board (tile_board.pure.ui.tsx):
 * place tiles into slots by tap or drag, undo, hint, check, try again.
 * Snapshot in, snapshot out; the component holds the snapshot in useState.
 */

export interface BoardTile {
  readonly id: string
  readonly label: string
}

export interface BoardItem {
  readonly kind: 'word' | 'equation'
  readonly instruction: string
  /** What "Hear it" and the hint say aloud. */
  readonly spoken: string
  readonly slots: number
  /** Labels, in slot order. Compared by label, so repeated labels ("to-ma-to") work. */
  readonly answer: readonly string[]
  /** Ids must be unique even when labels repeat: placement is tracked by id. */
  readonly tiles: readonly BoardTile[]
}

export interface TileResult {
  readonly kind: BoardItem['kind']
  readonly correct: boolean
  /** Tile ids, by slot. */
  readonly placement: readonly (string | null)[]
  /** The assembled answer: labels joined ('tomato'), or spaced for equations ('3 + 4'). */
  readonly value: string
  readonly hintsUsed: number
}

export type Feedback = 'none' | 'correct' | 'tryagain'

export interface TilesState {
  readonly placements: readonly (string | null)[]
  /** Slots in the order they were filled, for Undo. */
  readonly history: readonly number[]
  readonly hintOn: boolean
  readonly feedback: Feedback
  readonly hintsUsed: number
}

export function initialTiles(item: BoardItem): TilesState {
  return { placements: Array.from({ length: item.slots }, () => null), history: [], hintOn: false, feedback: 'none', hintsUsed: 0 }
}

/** Puts a tile in slot `index`. Moving from slot `from` swaps with whatever was there; a tile is never in two slots. */
export function placeTile(state: TilesState, tileId: string, index: number, from: number | null): TilesState {
  const existing = state.placements[index] ?? null
  const placements = state.placements.map((id, i): string | null => {
    if (i === index) return tileId
    if (from !== null && i === from) return existing !== null && existing !== tileId ? existing : null
    return id === tileId ? null : id
  })
  return { ...state, placements, history: [...state.history.filter((i) => i !== index), index], hintOn: false, feedback: 'none' }
}

export function removeFromSlot(state: TilesState, index: number): TilesState {
  return { ...state, placements: state.placements.map((id, i) => (i === index ? null : id)), history: state.history.filter((i) => i !== index), feedback: 'none' }
}

/** A tap on a tray tile fills the first empty slot; a tap on a placed tile sends it back to the tray. */
export function tapTile(state: TilesState, tileId: string, from: number | null): TilesState {
  if (from !== null) return removeFromSlot(state, from)
  const empty = state.placements.indexOf(null)
  return empty < 0 ? state : placeTile(state, tileId, empty, null)
}

export function undo(state: TilesState): TilesState {
  const last = state.history.at(-1)
  if (last === undefined) return state
  return { ...state, placements: state.placements.map((id, i) => (i === last ? null : id)), history: state.history.slice(0, -1), feedback: 'none' }
}

export function showHint(state: TilesState): TilesState {
  return { ...state, hintOn: true, feedback: 'none', hintsUsed: state.hintsUsed + 1 }
}

function labelOf(item: BoardItem, id: string | null): string | null {
  return id === null ? null : (item.tiles.find((t) => t.id === id)?.label ?? null)
}

export function isComplete(state: TilesState): boolean {
  return state.placements.length > 0 && state.placements.every((id) => id !== null)
}

/** Scores the placement and returns the result to report. */
export function check(state: TilesState, item: BoardItem): { readonly state: TilesState; readonly result: TileResult } {
  const labels = state.placements.map((id) => labelOf(item, id))
  const correct = labels.length === item.answer.length && labels.every((label, i) => label === item.answer[i])
  return {
    state: { ...state, feedback: correct ? 'correct' : 'tryagain', hintOn: false },
    result: { kind: item.kind, correct, placement: state.placements, value: labels.join(item.kind === 'word' ? '' : ' '), hintsUsed: state.hintsUsed },
  }
}

/** After a wrong check: keeps the tiles that are right, returns the rest to the tray. */
export function tryAgain(state: TilesState, item: BoardItem): TilesState {
  const placements = state.placements.map((id, i) => (id !== null && labelOf(item, id) === item.answer[i] ? id : null))
  return { ...state, placements, history: state.history.filter((i) => placements[i] !== null), feedback: 'none', hintOn: false }
}

/** Is this slot's tile right? For the try-again highlight. */
export function slotIsRight(state: TilesState, item: BoardItem, index: number): boolean {
  return labelOf(item, state.placements[index] ?? null) === item.answer[index]
}
