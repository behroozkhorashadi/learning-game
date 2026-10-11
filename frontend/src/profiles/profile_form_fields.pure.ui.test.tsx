import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ProfileFormFields, type ProfileFormFieldsProps } from './profile_form_fields.pure.ui.tsx'

afterEach(cleanup)

function renderFields(overrides: Partial<ProfileFormFieldsProps> = {}): ProfileFormFieldsProps {
  const props: ProfileFormFieldsProps = {
    today: '2026-10-10',
    name: '',
    onNameChange: vi.fn(),
    birthday: '',
    onBirthdayChange: vi.fn(),
    avatar: null,
    onAvatarChange: vi.fn(),
    readingSupport: false,
    onReadingSupportChange: vi.fn(),
    ...overrides,
  }
  render(<ProfileFormFields {...props} />)
  return props
}

describe('ProfileFormFields', () => {
  it('reports each edit through its callback', () => {
    const props = renderFields()
    fireEvent.change(screen.getByPlaceholderText('What should we call them?'), { target: { value: 'Nora' } })
    fireEvent.change(screen.getByLabelText('Birthday'), { target: { value: '2019-05-12' } })
    fireEvent.click(screen.getByRole('button', { name: 'Choose the owl avatar' }))
    fireEvent.click(screen.getByRole('checkbox', { name: /Extra reading help/ }))
    expect(props.onNameChange).toHaveBeenCalledWith('Nora')
    expect(props.onBirthdayChange).toHaveBeenCalledWith('2019-05-12')
    expect(props.onAvatarChange).toHaveBeenCalledWith('owl')
    expect(props.onReadingSupportChange).toHaveBeenCalledWith(true)
  })

  it('bounds the birthday to the supported ages, ending today', () => {
    renderFields()
    const input = screen.getByLabelText('Birthday')
    expect([input.getAttribute('min'), input.getAttribute('max')]).toEqual(['1927-01-01', '2026-10-10'])
  })

  it('shows the age for a valid birthday and a warning for an out-of-range one', () => {
    renderFields({ birthday: '2019-05-12' })
    expect(screen.getByText('That makes them 7 years old.')).toBeTruthy()
    cleanup()
    renderFields({ birthday: '2026-05-12' })
    expect(screen.getByText('Please enter a valid birthday.')).toBeTruthy()
  })

  it('marks the chosen avatar as pressed', () => {
    renderFields({ avatar: 'cat' })
    expect(screen.getByRole('button', { name: 'Choose the cat avatar' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: 'Choose the owl avatar' }).getAttribute('aria-pressed')).toBe('false')
  })
})
