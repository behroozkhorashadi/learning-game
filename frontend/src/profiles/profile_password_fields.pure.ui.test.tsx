import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { EMPTY_PASSWORD_DRAFT } from './profile_password.pure.lib.ts'
import { ProfilePasswordFields } from './profile_password_fields.pure.ui.tsx'

afterEach(cleanup)

describe('ProfilePasswordFields', () => {
  it('reports each box as a new draft', () => {
    const onChange = vi.fn()
    render(<ProfilePasswordFields draft={EMPTY_PASSWORD_DRAFT} onChange={onChange} />)
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'tiger' } })
    expect(onChange).toHaveBeenLastCalledWith({ password: 'tiger', confirm: '', remove: false })
    fireEvent.change(screen.getByLabelText('Type the password again'), { target: { value: 'tig' } })
    expect(onChange).toHaveBeenLastCalledWith({ password: '', confirm: 'tig', remove: false })
  })

  it('says nothing about a blank draft and explains an invalid one', () => {
    render(<ProfilePasswordFields draft={EMPTY_PASSWORD_DRAFT} onChange={vi.fn()} />)
    expect(screen.queryByText(/characters|match/)).toBeNull()
    cleanup()
    render(<ProfilePasswordFields draft={{ password: 'tiger', confirm: 'tige', remove: false }} onChange={vi.fn()} />)
    expect(screen.getByText("The two passwords don't match yet.")).toBeTruthy()
  })

  it('on the edit screen, offers to remove an existing password and disables the boxes while removing', () => {
    const onChange = vi.fn()
    render(<ProfilePasswordFields draft={{ password: 'x', confirm: '', remove: false }} onChange={onChange} hasPassword />)
    expect(screen.getByLabelText('New password')).toBeTruthy()
    fireEvent.click(screen.getByRole('checkbox', { name: /Remove the password/ }))
    expect(onChange).toHaveBeenLastCalledWith({ password: '', confirm: '', remove: true })
    cleanup()

    render(<ProfilePasswordFields draft={{ password: '', confirm: '', remove: true }} onChange={vi.fn()} hasPassword />)
    expect(screen.getByLabelText('New password')).toHaveProperty('disabled', true)
  })

  it('has no remove option for a new player', () => {
    render(<ProfilePasswordFields draft={EMPTY_PASSWORD_DRAFT} onChange={vi.fn()} />)
    expect(screen.queryByRole('checkbox')).toBeNull()
  })
})
