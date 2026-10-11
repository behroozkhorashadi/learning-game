import type { CustomMapRecord, Dialogs, DotPuzzle, LevelProgressStore, ListPublishedMaps, MapLibrary, PublishedMapRecord, ScheduleTimeout, SubscribeToFocus } from './pathfinder_state.pure.lib.ts'

/**
 * Test/story fakes for the Pathfinder capabilities: an in-memory server
 * (completions, per-profile maps, the published list), scripted dialogs, a
 * manual timer, and a manual window-focus signal. Every screen is bound over
 * these through its bind* seam, so no test touches fetch or window.
 */

export interface FakePathfinderServer extends LevelProgressStore, MapLibrary {
  readonly listPublishedMaps: ListPublishedMaps
  /** Completed ids per profile, in the order they were recorded. */
  readonly completions: Map<number, string[]>
  /** Author names for the published listing, keyed by profile id. */
  readonly profileNames: Map<number, string>
  /** Every saved map, with its owner. */
  readonly maps: () => readonly (CustomMapRecord & { readonly profileId: number })[]
  /** While true, every call rejects (the server is down). */
  failing: boolean
  /** How many calls have been made, by method name. */
  readonly calls: (method: string) => number
  /** Stores a map directly, synchronously, with no call counted and ignoring `failing` (for setting up a scenario). */
  readonly seed: (profileId: number, puzzle: DotPuzzle, published?: boolean) => void
}

export function fakePathfinderServer(): FakePathfinderServer {
  let clock = 0
  let maps: (CustomMapRecord & { readonly profileId: number })[] = []
  const counts = new Map<string, number>()
  const completions = new Map<number, string[]>()
  const profileNames = new Map<number, string>()

  function guard(method: string): void {
    counts.set(method, (counts.get(method) ?? 0) + 1)
    if (server.failing) throw new Error(`${method} failed with HTTP 500`)
  }
  function newestFirst<T extends { readonly createdAt: string }>(rows: readonly T[]): T[] {
    return [...rows].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }
  function find(profileId: number, mapId: string): CustomMapRecord & { readonly profileId: number } {
    const row = maps.find((m) => m.profileId === profileId && m.puzzle.id === mapId)
    if (row === undefined) throw new Error(`no map ${mapId}`)
    return row
  }
  function replace(next: CustomMapRecord & { readonly profileId: number }): void {
    maps = maps.map((m) => (m.profileId === next.profileId && m.puzzle.id === next.puzzle.id ? next : m))
  }
  const strip = ({ puzzle, createdAt, published }: CustomMapRecord): CustomMapRecord => ({ puzzle, createdAt, published })

  function insert(profileId: number, puzzle: DotPuzzle, published: boolean): CustomMapRecord & { readonly profileId: number } {
    clock += 1
    const row = { profileId, puzzle: { ...puzzle, name: puzzle.name ?? '' }, published, createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, clock)).toISOString() }
    maps.push(row)
    return row
  }

  const server: FakePathfinderServer = {
    seed: (profileId, puzzle, published = false) => {
      insert(profileId, puzzle, published)
    },
    completions,
    profileNames,
    failing: false,
    maps: () => maps,
    calls: (method) => counts.get(method) ?? 0,
    listCompletions: async (profileId) => {
      guard('listCompletions')
      return new Set(completions.get(profileId) ?? [])
    },
    addCompletion: async (profileId, levelId) => {
      guard('addCompletion')
      const ids = completions.get(profileId) ?? []
      if (!ids.includes(levelId)) ids.push(levelId)
      completions.set(profileId, ids)
      return new Set(ids)
    },
    listMaps: async (profileId) => {
      guard('listMaps')
      return newestFirst(maps.filter((m) => m.profileId === profileId)).map(strip)
    },
    saveMap: async (profileId, puzzle) => {
      guard('saveMap')
      return strip(insert(profileId, puzzle, false))
    },
    deleteMap: async (profileId, mapId) => {
      guard('deleteMap')
      const row = find(profileId, mapId)
      maps = maps.filter((m) => m !== row)
    },
    renameMap: async (profileId, mapId, name) => {
      guard('renameMap')
      const row = find(profileId, mapId)
      replace({ ...row, puzzle: { ...row.puzzle, name } })
    },
    setMapPublished: async (profileId, mapId, published) => {
      guard('setMapPublished')
      replace({ ...find(profileId, mapId), published })
    },
    listPublishedMaps: async () => {
      guard('listPublishedMaps')
      return newestFirst(maps.filter((m) => m.published)).map(
        (m): PublishedMapRecord => ({ puzzle: m.puzzle, authorProfileId: m.profileId, authorName: profileNames.get(m.profileId) ?? `Player ${String(m.profileId)}` }),
      )
    },
  }
  return server
}

/** `server.seed`, for tests that read better awaiting their setup. */
export function seedMap(server: FakePathfinderServer, profileId: number, puzzle: DotPuzzle, published = false): Promise<void> {
  server.seed(profileId, puzzle, published)
  return Promise.resolve()
}

export interface ScriptedDialogs extends Dialogs {
  /** Answers for the next confirm()s, in order (default true). */
  readonly confirms: boolean[]
  /** Answers for the next prompt()s, in order; `undefined` accepts the default. */
  readonly prompts: (string | null | undefined)[]
  /** Every message shown, for asserting on wording. */
  readonly shown: string[]
}

export function scriptedDialogs(): ScriptedDialogs {
  const dialogs: ScriptedDialogs = {
    confirms: [],
    prompts: [],
    shown: [],
    confirm: (message) => {
      dialogs.shown.push(message)
      return dialogs.confirms.shift() ?? true
    },
    prompt: (message, defaultValue) => {
      dialogs.shown.push(message)
      const answer = dialogs.prompts.shift()
      return answer === undefined ? defaultValue : answer
    },
  }
  return dialogs
}

export interface ManualTimers {
  readonly schedule: ScheduleTimeout
  /** Fires every pending timer. */
  readonly fireAll: () => void
  readonly pending: () => number
}

export function manualTimers(): ManualTimers {
  const timers = new Set<() => void>()
  return {
    schedule: (callback) => {
      const entry = (): void => {
        timers.delete(entry)
        callback()
      }
      timers.add(entry)
      return () => {
        timers.delete(entry)
      }
    },
    fireAll: () => {
      for (const timer of timers) timer()
    },
    pending: () => timers.size,
  }
}

export interface ManualFocus {
  readonly subscribe: SubscribeToFocus
  readonly focus: () => void
  readonly listeners: () => number
}

export function manualFocus(): ManualFocus {
  const listeners = new Set<() => void>()
  return {
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    focus: () => {
      for (const listener of listeners) listener()
    },
    listeners: () => listeners.size,
  }
}

/** A 2x2 square board: solvable, four dots. */
export function squarePuzzle(id: string, name = 'My Puzzle'): DotPuzzle {
  return {
    id,
    name,
    difficulty: 'easy',
    rows: 2,
    columns: 2,
    dots: [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 1, col: 1 },
      { row: 1, col: 0 },
    ],
  }
}
