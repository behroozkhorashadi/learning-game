import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { manualTimers } from '@app/timing/manual_timers.test.lib.ts'
import { useRevisionPass } from './use_revision_pass.pure.hook.ts'
import { fakeWriter } from './writing_fakes.test.lib.ts'
import { COACH_THINKING_MS } from './writing_game_state.pure.lib.ts'

const PIECE = { profile_id: 1, game_id: 'prompt_forge', body: 'x' }

describe('useRevisionPass', () => {
  it('thinks, then asks; tracks whether the kid changed anything', () => {
    const timers = manualTimers()
    const { result } = renderHook(() => useRevisionPass({ pieces: fakeWriter(), timers }))
    act(() => {
      result.current.begin('my draft')
    })
    expect([result.current.status, result.current.text, result.current.changed]).toEqual(['thinking', 'my draft', false])
    act(() => {
      timers.advance(COACH_THINKING_MS)
    })
    expect(result.current.status).toBe('questions')
    act(() => {
      result.current.setText('my better draft')
    })
    expect(result.current.changed).toBe(true)
  })

  it('saves the piece, then the game records, then the revision', async () => {
    const writer = fakeWriter()
    const order: string[] = []
    const { result } = renderHook(() => useRevisionPass({ pieces: writer, timers: manualTimers() }))
    act(() => {
      result.current.begin('a')
      result.current.setText('b')
    })
    let saved: Awaited<ReturnType<typeof result.current.finish>> = null
    await act(async () => {
      saved = await result.current.finish(PIECE, ['Q1'], (id) => {
        order.push(`extra ${id}`)
        return Promise.resolve()
      })
    })
    expect(saved).toMatchObject({ id: 'piece-1' })
    expect(order).toEqual(['extra piece-1'])
    expect(writer.revisions).toEqual([{ pieceId: 'piece-1', revision: { questions_asked: ['Q1'], changed: true } }])
    expect(result.current.status).toBe('done')
  })

  it('shows a failed save and stays in the pass', async () => {
    const { result } = renderHook(() => useRevisionPass({ pieces: fakeWriter('POST /api/pieces failed with HTTP 500'), timers: manualTimers() }))
    await act(async () => {
      expect(await result.current.finish(PIECE, [])).toBeNull()
    })
    expect([result.current.error, result.current.saving, result.current.status]).toEqual(['POST /api/pieces failed with HTTP 500', false, 'thinking'])
  })
})
