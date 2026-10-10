import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TodoRow } from './todo.pure.ui.tsx'
import { toTodoId } from './todo_state.pure.lib.ts'

afterEach(cleanup)

const todo = { id: toTodoId('a'), title: 'Feed the cat', done: false }

describe('TodoRow', () => {
  it('shows the title as the checkbox label, unchecked when not done', () => {
    render(<TodoRow todo={todo} onToggle={vi.fn()} onRemove={vi.fn()} />)
    expect(screen.getByRole('checkbox', { name: 'Feed the cat' })).toHaveProperty('checked', false)
  })

  it('reports its id when toggled or removed', () => {
    const onToggle = vi.fn()
    const onRemove = vi.fn()
    render(<TodoRow todo={todo} onToggle={onToggle} onRemove={onRemove} />)
    fireEvent.click(screen.getByRole('checkbox', { name: 'Feed the cat' }))
    fireEvent.click(screen.getByRole('button', { name: 'Remove "Feed the cat"' }))
    expect(onToggle).toHaveBeenCalledWith('a')
    expect(onRemove).toHaveBeenCalledWith('a')
  })
})
