/**
 * Pathfinder: No Way Back — level/map data shape. Kept dependency-free so it
 * can be imported by the solver, the rules, and the renderer without pulling
 * React or any game-loop code along with it.
 */

export interface GridPosition {
  readonly row: number
  readonly col: number
}

export type Difficulty = 'easy' | 'medium' | 'hard' | 'legendary'

/** No board (curated or player-built) may exceed this many rows or columns
 * — a hard ceiling of 2,500 dots, chosen so the solver is guaranteed to
 * stay fast (see pathfinder_solver.pure.lib.test.ts's 50x50 performance check). */
export const MAX_BOARD_DIMENSION = 50

export interface DotPuzzle {
  readonly id: string
  readonly name?: string
  readonly difficulty: Difficulty
  readonly rows: number
  readonly columns: number
  /** Grid positions that hold a dot. Everything else on the rows x columns
   * grid is an empty gap the path can't cross. */
  readonly dots: readonly GridPosition[]
}

/** A saved custom map, as the My Maps page lists it. */
export interface CustomMapRecord {
  readonly puzzle: DotPuzzle
  readonly createdAt: string
  readonly published: boolean
}

/** A map someone published, as the Published Maps screen shows it. */
export interface PublishedMapRecord {
  readonly puzzle: DotPuzzle
  readonly authorProfileId: number
  readonly authorName: string
}

/** Per-profile level completions, stored server-side so progress follows the profile. In the app, the Pathfinder API adapter. */
export interface LevelProgressStore {
  readonly listCompletions: (profileId: number) => Promise<ReadonlySet<string>>
  /** Resolves to the profile's full, updated set of completed ids. */
  readonly addCompletion: (profileId: number, levelId: string) => Promise<ReadonlySet<string>>
}

/** A profile's saved custom maps. In the app, the Pathfinder API adapter. */
export interface MapLibrary {
  /** Most recently created first. */
  readonly listMaps: (profileId: number) => Promise<readonly CustomMapRecord[]>
  readonly saveMap: (profileId: number, puzzle: DotPuzzle) => Promise<CustomMapRecord>
  readonly deleteMap: (profileId: number, mapId: string) => Promise<void>
  readonly renameMap: (profileId: number, mapId: string, name: string) => Promise<void>
  readonly setMapPublished: (profileId: number, mapId: string, published: boolean) => Promise<void>
}

/** Every profile's published maps, newest first. */
export type ListPublishedMaps = () => Promise<readonly PublishedMapRecord[]>

/** Starts a one-shot timer and returns its cancel. In the app, setTimeout/clearTimeout. */
export type ScheduleTimeout = (callback: () => void, ms: number) => () => void

/** Blocking browser dialogs. In the app, window.confirm / window.prompt. */
export interface Dialogs {
  readonly confirm: (message: string) => boolean
  /** The entered text, or null if cancelled. */
  readonly prompt: (message: string, defaultValue: string) => string | null
}

/** Calls `listener` whenever the window regains focus; returns the unsubscribe. */
export type SubscribeToFocus = (listener: () => void) => () => void
