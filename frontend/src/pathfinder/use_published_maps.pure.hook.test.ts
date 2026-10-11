import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { fakePathfinderServer, manualFocus, seedMap, squarePuzzle } from './pathfinder_fakes.test.lib.ts'
import type { PublishedMapRecord } from './pathfinder_state.pure.lib.ts'
import { usePublishedMaps } from './use_published_maps.pure.hook.ts'

describe('usePublishedMaps', () => {
  it('loads on mount and reloads whenever the window regains focus', async () => {
    const server = fakePathfinderServer()
    const focus = manualFocus()
    const { result } = renderHook(() => usePublishedMaps(server.listPublishedMaps, focus.subscribe))
    expect(result.current.records).toBeNull()
    await waitFor(() => {
      expect(result.current.records).toEqual([])
    })

    await seedMap(server, 7, squarePuzzle('custom-a', 'Spiral'), true)
    act(() => {
      focus.focus()
    })
    await waitFor(() => {
      expect(result.current.records?.map((r) => r.puzzle.id)).toEqual(['custom-a'])
    })
    expect(server.calls('listPublishedMaps')).toBe(2)
  })

  it('a failed reload keeps the last list and flags the failure; the next success clears it', async () => {
    const server = fakePathfinderServer()
    const focus = manualFocus()
    await seedMap(server, 7, squarePuzzle('custom-a'), true)
    const { result } = renderHook(() => usePublishedMaps(server.listPublishedMaps, focus.subscribe))
    await waitFor(() => {
      expect(result.current.records).toHaveLength(1)
    })
    server.failing = true
    act(() => {
      focus.focus()
    })
    await waitFor(() => {
      expect(result.current.failed).toBe(true)
    })
    expect(result.current.records).toHaveLength(1)
    server.failing = false
    act(() => {
      focus.focus()
    })
    await waitFor(() => {
      expect(result.current.failed).toBe(false)
    })
  })

  it('drops a result that arrives after unmount and unsubscribes from focus', async () => {
    let resolve: (records: readonly PublishedMapRecord[]) => void = () => undefined
    const focus = manualFocus()
    const list = (): Promise<readonly PublishedMapRecord[]> =>
      new Promise((r) => {
        resolve = r
      })
    const { result, unmount } = renderHook(() => usePublishedMaps(list, focus.subscribe))
    unmount()
    await act(async () => {
      resolve([])
    })
    expect(result.current.records).toBeNull()
    expect(focus.listeners()).toBe(0)
  })
})
