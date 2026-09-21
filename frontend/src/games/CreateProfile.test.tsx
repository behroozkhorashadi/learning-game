import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { CreateProfile } from './CreateProfile'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function fillValidForm() {
  fireEvent.change(screen.getByPlaceholderText('What should we call them?'), { target: { value: 'Nora' } })
  fireEvent.change(screen.getByLabelText('Birthday'), { target: { value: '2019-05-12' } })
  fireEvent.click(screen.getByRole('button', { name: 'Choose the cat avatar' }))
}

describe('CreateProfile', () => {
  it('does nothing on submit until name, birthday, and avatar are all set', () => {
    global.fetch = vi.fn() as unknown as typeof fetch
    render(<CreateProfile onCreated={vi.fn()} onCancel={vi.fn()} />)

    const submit = screen.getByRole('button', { name: 'Create profile' })
    fireEvent.click(submit)
    expect(global.fetch).not.toHaveBeenCalled()

    fireEvent.change(screen.getByPlaceholderText('What should we call them?'), { target: { value: 'Nora' } })
    fireEvent.click(submit)
    expect(global.fetch).not.toHaveBeenCalled()

    fireEvent.change(screen.getByLabelText('Birthday'), { target: { value: '2019-05-12' } })
    fireEvent.click(submit) // still no avatar
    expect(global.fetch).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Choose the cat avatar' }))
    fireEvent.click(submit)
    expect(global.fetch).toHaveBeenCalled()
  })

  it('rejects a birthday that puts the player outside the supported age range', () => {
    global.fetch = vi.fn() as unknown as typeof fetch
    render(<CreateProfile onCreated={vi.fn()} onCancel={vi.fn()} />)

    fireEvent.change(screen.getByPlaceholderText('What should we call them?'), { target: { value: 'Nora' } })
    fireEvent.change(screen.getByLabelText('Birthday'), { target: { value: '1990-01-01' } })
    fireEvent.click(screen.getByRole('button', { name: 'Choose the cat avatar' }))

    expect(screen.getByText(/built for ages/i)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Create profile' }))
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('submits the right payload and reports the created profile', async () => {
    const createdProfile = { id: 3, name: 'Nora', avatar: 'cat', birth_year: 2019, reading_support: false }
    global.fetch = vi.fn(() =>
      Promise.resolve({ ok: true, json: async () => createdProfile } as Response),
    ) as unknown as typeof fetch
    const onCreated = vi.fn()

    render(<CreateProfile onCreated={onCreated} onCancel={vi.fn()} />)
    fillValidForm()
    fireEvent.click(screen.getByRole('button', { name: 'Create profile' }))

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(createdProfile))

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/profiles',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'Nora', avatar: 'cat', birth_year: 2019, reading_support: false }),
      }),
    )
  })

  it('shows the server error and does not call onCreated when the request fails', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({ ok: false, status: 422, json: async () => ({ detail: 'name must not be blank' }) } as Response),
    ) as unknown as typeof fetch
    const onCreated = vi.fn()

    render(<CreateProfile onCreated={onCreated} onCancel={vi.fn()} />)
    fillValidForm()
    fireEvent.click(screen.getByRole('button', { name: 'Create profile' }))

    await screen.findByText(/name must not be blank/i)
    expect(onCreated).not.toHaveBeenCalled()
  })

  it('calls onCancel when Cancel is clicked', () => {
    const onCancel = vi.fn()
    render(<CreateProfile onCreated={vi.fn()} onCancel={onCancel} />)

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onCancel).toHaveBeenCalled()
  })
})
