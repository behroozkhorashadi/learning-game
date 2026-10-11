import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { assembleDevScreens } from './dev_screens.assembly.main.ts'

beforeAll(() => {
  // jsdom has no ResizeObserver; the 3D screens' <Canvas> mounts (at zero size, so without WebGL) once it's stubbed.
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    },
  )
})

afterEach(() => {
  cleanup()
  localStorage.clear()
})

describe('assembleDevScreens', () => {
  it('lists every screen once, by unique id, starting with the worked example', () => {
    const screens = assembleDevScreens()
    const ids = screens.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids[0]).toBe('todo-example')
    expect(ids).toContain('zombie-hit-lab')
  })

  it('renders the mock-data screens without a backend', async () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => undefined)))
    for (const id of ['todo-example', 'session-start', 'tile-assembly', 'writing-surface', 'coach-panel', 'modifier-rule-bar', 'illustration-arrival']) {
      const entry = assembleDevScreens().find((s) => s.id === id)
      if (entry === undefined) throw new Error(`no dev screen ${id}`)
      await act(async () => {
        render(<entry.Screen />)
      })
      expect(document.body.textContent.length, id).toBeGreaterThan(0)
      cleanup()
    }
    vi.unstubAllGlobals()
  })
})
