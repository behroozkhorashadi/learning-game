import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { assembleAppScreens, assembleRoot } from './app.assembly.main.ts'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  window.history.replaceState(null, '', '/')
})

function respond(body: unknown): Promise<Response> {
  return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }))
}

describe('assembleRoot', () => {
  it('assembles every app screen', () => {
    expect(Object.values(assembleAppScreens()).every((s) => typeof s === 'function')).toBe(true)
  })

  it('opens on the real profile picker, with the dev link in dev builds', async () => {
    vi.stubGlobal('fetch', vi.fn(() => respond([{ id: 7, name: 'Ada', avatar: 'cat', birth_year: 2017 }])))
    const Root = assembleRoot()
    await act(async () => {
      render(<Root />)
    })
    expect(await screen.findByRole('button', { name: 'Play as Ada' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Dev screens' })).toBeTruthy()
  })

  it('shows the dev picker for ?screen= in dev builds', () => {
    window.history.replaceState(null, '', '/?screen=index')
    const Root = assembleRoot()
    render(<Root />)
    expect(screen.getByRole('navigation', { name: 'Dev screens' })).toBeTruthy()
  })
})
