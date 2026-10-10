import { describe, expect, it } from 'vitest'
import { errorMessage, failed, loaded } from './query_state.pure.lib.ts'

describe('query state', () => {
  it('builds loaded and failed states', () => {
    expect(loaded([1])).toEqual({ kind: 'loaded', data: [1] })
    expect(failed('x')).toEqual({ kind: 'failed', message: 'x' })
  })

  it('reads a message from Errors and anything else', () => {
    expect(errorMessage(new Error('boom'))).toBe('boom')
    expect(errorMessage('plain')).toBe('plain')
  })
})
