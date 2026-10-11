import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { LabShot } from './hit_lab_state.pure.lib.ts'
import { bindZombieHitLab, type ZombieHitLabDeps } from './zombie_hit_lab.effect.ui.tsx'

/**
 * The hit lab's controls, scoring, and persistence, around a canvas that
 * can't draw in jsdom (so shots themselves are the e2e eval's job).
 */

/** jsdom has no ResizeObserver; with it stubbed, R3F's <Canvas> mounts (at zero size, so it never needs WebGL). */
function stubResizeObserver(): void {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    },
  )
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function shot(id: string, expected: LabShot['expected'], recorded: LabShot['recorded']): LabShot {
  return { id, characterId: 'scientist', lane: 1, distance: 0.5, poseTime: 0.5, ndc: { x: 0, y: 0 }, expected, recorded }
}

function renderLab(initial: readonly LabShot[], overrides: Partial<ZombieHitLabDeps> = {}) {
  stubResizeObserver()
  let saved: string | null = JSON.stringify(initial)
  const keyListeners = new Set<(key: string) => void>()
  const downloads: { name: string; text: string }[] = []
  const deps: ZombieHitLabDeps = {
    search: '?lane=1&distance=0.5&pose=0.5',
    storage: {
      load: () => saved,
      save: (text) => {
        saved = text
      },
    },
    appendToTestSet: () => Promise.resolve({ added: 1, total: 41 }),
    download: (name, text) => downloads.push({ name, text }),
    keys: (onKey) => {
      keyListeners.add(onKey)
      return () => keyListeners.delete(onKey)
    },
    clock: { now: () => 0, wait: () => Promise.resolve(), defer: (run) => run() },
    createShotId: () => 'new-shot',
    today: () => '2026-10-10',
    ...overrides,
  }
  const ZombieHitLab = bindZombieHitLab(deps)
  render(<ZombieHitLab />)
  return { press: (key: string) => act(() => keyListeners.forEach((l) => l(key))), downloads, saved: () => saved }
}

describe('ZombieHitLab', () => {
  it('starts from the URL setup, not yet ready to shoot', () => {
    renderLab([])
    expect(screen.getByRole('combobox', { name: 'Lane' })).toHaveProperty('value', '1')
    expect(screen.getByRole('region', { name: 'Shooting range' }).dataset['zombieReady']).toBe('false')
  })

  it('labels the waiting shot from the keyboard or the buttons, and saves it', () => {
    const lab = renderLab([shot('a', null, 'head')])
    expect(screen.getByRole('group', { name: 'Label the shot' }).textContent).toContain('HEAD')
    lab.press('b')
    expect(screen.queryByRole('group', { name: 'Label the shot' })).toBeNull()
    expect(JSON.parse(lab.saved() ?? '[]')).toMatchObject([{ id: 'a', expected: 'body' }])
  })

  it('scores labeled shots', () => {
    renderLab([shot('a', 'head', 'head'), shot('b', 'miss', 'body')])
    expect(screen.getByRole('status').textContent).toContain('Labeled 2 · hit/miss agreement 50%')
  })

  it('undoes with Z, and clears all', () => {
    const lab = renderLab([shot('a', 'head', 'head'), shot('b', 'body', 'body')])
    lab.press('z')
    expect(JSON.parse(lab.saved() ?? '[]')).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Clear all' }))
    expect(lab.saved()).toBe('[]')
  })

  it('downloads the labeled shots as the fixture document', () => {
    const lab = renderLab([shot('a', 'head', 'head')])
    fireEvent.click(screen.getByRole('button', { name: 'Download JSON' }))
    expect(lab.downloads.map((d) => d.name)).toEqual(['zombie-hit-lab-2026-10-10.json'])
    expect(JSON.parse(lab.downloads[0]?.text ?? '{}')).toMatchObject({ version: 1, shots: [{ id: 'a' }] })
  })

  it('saves to the eval test set and says how it went', async () => {
    renderLab([shot('a', 'head', 'head')])
    fireEvent.click(screen.getByRole('button', { name: 'Save to test set' }))
    await act(async () => undefined)
    expect(screen.getByText('Added 1 new shot — test set now has 41')).toBeTruthy()
  })

  it('reports a failed save', async () => {
    renderLab([shot('a', 'head', 'head')], { appendToTestSet: () => Promise.reject(new Error('POST /__hit-lab/append failed with HTTP 404')) })
    fireEvent.click(screen.getByRole('button', { name: 'Save to test set' }))
    await act(async () => undefined)
    expect(screen.getByText('Save failed: POST /__hit-lab/append failed with HTTP 404')).toBeTruthy()
  })

  it('imports shots from a file', async () => {
    const lab = renderLab([])
    const text = JSON.stringify({ shots: [shot('x', 'miss', 'miss')] })
    // jsdom's File has no text(); the lab reads only that.
    const file = Object.assign(new File([text], 'shots.json', { type: 'application/json' }), { text: () => Promise.resolve(text) })
    fireEvent.change(screen.getByLabelText('Import shots'), { target: { files: [file] } })
    await act(async () => undefined)
    expect(JSON.parse(lab.saved() ?? '[]')).toMatchObject([{ id: 'x' }])
  })

  it('changes the setup from the controls', () => {
    renderLab([])
    fireEvent.change(screen.getByRole('combobox', { name: 'Lane' }), { target: { value: '3' } })
    expect(screen.getByRole('combobox', { name: 'Lane' })).toHaveProperty('value', '3')
    fireEvent.click(screen.getByRole('button', { name: 'Hockey' }))
    expect(screen.getByRole('button', { name: 'Hockey' }).getAttribute('aria-pressed')).toBe('true')
  })
})
