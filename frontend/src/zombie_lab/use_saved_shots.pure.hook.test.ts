import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { LabShot } from './hit_lab_state.pure.lib.ts'
import { useSavedShots } from './use_saved_shots.pure.hook.ts'

const SHOT: LabShot = { id: 'a', characterId: 'scientist', lane: 1, distance: 0.5, poseTime: 0.5, ndc: { x: 0, y: 0 }, expected: 'head', recorded: 'head' }

describe('useSavedShots', () => {
  it('loads what was saved and saves every change', () => {
    let saved: string | null = JSON.stringify([SHOT])
    const storage = {
      load: () => saved,
      save: (text: string) => {
        saved = text
      },
    }
    const { result } = renderHook(() => useSavedShots(storage))
    expect(result.current[0]).toEqual([SHOT])
    act(() => {
      result.current[1]([])
    })
    expect(saved).toBe('[]')
  })
})
