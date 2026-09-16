/**
 * Pathfinder: No Way Back — level/map data shape. Kept dependency-free so it
 * can be imported by the solver, the rules, and the renderer without pulling
 * React or any game-loop code along with it.
 */

export type GridPosition = {
  row: number
  col: number
}

export type Difficulty = 'easy' | 'medium' | 'hard'

export type DotPuzzle = {
  id: string
  name?: string
  difficulty: Difficulty
  rows: number
  columns: number
  /** Grid positions that hold a dot. Everything else on the rows x columns
   * grid is an empty gap the path can't cross. */
  dots: GridPosition[]
}
