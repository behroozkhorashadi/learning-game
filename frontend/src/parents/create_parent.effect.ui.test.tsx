import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ParentRecord } from '@app/api/parents_schema.pure.lib.ts'
import type { ParentCreateBody } from './create_parent_draft.pure.lib.ts'
import { bindCreateParent } from './create_parent.effect.ui.tsx'
import { MOM } from './parents_fixtures.test.lib.ts'

afterEach(cleanup)

function renderScreen(create: (body: ParentCreateBody) => Promise<ParentRecord>) {
  const Screen = bindCreateParent({ createParent: create })
  const onCreated = vi.fn()
  const onCancel = vi.fn()
  render(<Screen onCreated={onCreated} onCancel={onCancel} />)
  return { onCreated, onCancel }
}

function fill(name: string, password: string, confirm: string): void {
  fireEvent.change(screen.getByLabelText('Your name'), { target: { value: name } })
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: password } })
  fireEvent.change(screen.getByLabelText('Password again'), { target: { value: confirm } })
}

describe('CreateParent', () => {
  it('says what is missing until the form is complete, then creates and signs in', async () => {
    const create = vi.fn((_body: ParentCreateBody) => Promise.resolve(MOM))
    const { onCreated } = renderScreen(create)
    const submit = screen.getByRole('button', { name: 'Create parent account' })
    fill(' Mom ', 'abcd', 'abce')
    expect(screen.getByText('The two passwords don’t match.')).toBeTruthy()
    fireEvent.click(submit)
    expect(create).not.toHaveBeenCalled()
    fill(' Mom ', 'abcd', 'abcd')
    fireEvent.click(submit)
    await waitFor(() => {
      expect(onCreated).toHaveBeenCalledWith(MOM, 'abcd')
    })
    expect(create).toHaveBeenCalledWith({ name: 'Mom', password: 'abcd' })
  })

  it("shows the server's message and cancels", async () => {
    const { onCancel } = renderScreen(() => Promise.reject(new Error('name must be 1-40 characters')))
    fill('Mom', 'abcd', 'abcd')
    fireEvent.click(screen.getByRole('button', { name: 'Create parent account' }))
    expect((await screen.findByRole('alert')).textContent).toBe('name must be 1-40 characters')
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalled()
  })
})
