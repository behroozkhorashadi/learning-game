import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { assembleCreateParent } from './create_parent.assembly.main.ts'

/** The real graph: assembled screen → parents adapter → (stubbed) global fetch. */

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('assembleCreateParent', () => {
  it('POSTs the new parent and hands back the parsed account', async () => {
    const fetchFake = vi.fn((_url: string, _init?: RequestInit) => Promise.resolve(new Response(JSON.stringify({ id: 4, name: 'Dad', created_at: '2026-10-14T00:00:00' }), { status: 201 })))
    vi.stubGlobal('fetch', fetchFake)
    const CreateParent = assembleCreateParent()
    const onCreated = vi.fn()
    render(<CreateParent onCreated={onCreated} onCancel={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Dad' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'abcd' } })
    fireEvent.change(screen.getByLabelText('Password again'), { target: { value: 'abcd' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create parent account' }))
    await waitFor(() => {
      expect(onCreated).toHaveBeenCalledWith(expect.objectContaining({ id: 4, name: 'Dad' }), 'abcd')
    })
    expect(fetchFake).toHaveBeenCalledWith('/api/parents', expect.objectContaining({ method: 'POST' }))
  })
})
