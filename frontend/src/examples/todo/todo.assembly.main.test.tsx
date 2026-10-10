import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { assembleTodos } from './todo.assembly.main.ts'

/**
 * The one real-graph test: assembleTodos() with jsdom's real localStorage and
 * crypto. Only the network edge is replaced (a stubbed global fetch), never a
 * module of ours.
 */

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  window.history.replaceState(null, '', '/')
})

function addTodo(title: string): void {
  fireEvent.change(screen.getByRole('textbox', { name: 'New todo' }), { target: { value: title } })
  fireEvent.click(screen.getByRole('button', { name: 'Add' }))
}

describe('assembleTodos', () => {
  it('persists to localStorage, so a fresh assembly hydrates the same list', () => {
    const First = assembleTodos()
    render(<First />)
    addTodo('Feed the cat')
    cleanup()

    const Second = assembleTodos()
    render(<Second />)
    expect(screen.getByRole('checkbox', { name: 'Feed the cat' })).toBeTruthy()
  })

  it('hides backup unless ?flags=examples_todo_backup is set', () => {
    const Todos = assembleTodos()
    render(<Todos />)
    expect(screen.queryByRole('button', { name: 'Back up to server' })).toBeNull()
  })

  it('backs up through PUT /api/examples/todos when the flag is on', async () => {
    window.history.replaceState(null, '', '/?flags=examples_todo_backup')
    const fetchFake = vi.fn((_url: string, init: { readonly body?: string }) =>
      Promise.resolve(new Response(init.body ?? '[]', { status: 200, headers: { 'Content-Type': 'application/json' } })),
    )
    vi.stubGlobal('fetch', fetchFake)

    const Todos = assembleTodos()
    render(<Todos />)
    addTodo('Feed the cat')
    fireEvent.click(screen.getByRole('button', { name: 'Back up to server' }))

    expect(await screen.findByText('Backed up 1 todo')).toBeTruthy()
    expect(fetchFake).toHaveBeenCalledWith('/api/examples/todos', expect.objectContaining({ method: 'PUT' }))
  })
})
