import { afterEach, describe, expect, it, vi } from 'vitest'
import { assembleMotionPreference } from './motion_preference.assembly.main.ts'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('assembleMotionPreference', () => {
  it('is "no preference" without matchMedia (jsdom)', () => {
    expect(assembleMotionPreference().prefersReduced()).toBe(false)
  })

  it('reads prefers-reduced-motion and subscribes to its changes', () => {
    const listeners: (() => void)[] = []
    const query = { matches: true, addEventListener: (_: string, l: () => void) => listeners.push(l), removeEventListener: vi.fn() }
    const matchMedia = vi.fn(() => query)
    vi.stubGlobal('matchMedia', matchMedia)
    const preference = assembleMotionPreference()
    expect(matchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)')
    expect(preference.prefersReduced()).toBe(true)
    const onChange = vi.fn()
    const stop = preference.subscribe(onChange)
    listeners[0]?.()
    expect(onChange).toHaveBeenCalled()
    stop()
    expect(query.removeEventListener).toHaveBeenCalledWith('change', onChange)
  })

  it('treats a matchMedia that throws as no preference', () => {
    vi.stubGlobal('matchMedia', () => {
      throw new Error('stub')
    })
    expect(assembleMotionPreference().prefersReduced()).toBe(false)
  })
})
