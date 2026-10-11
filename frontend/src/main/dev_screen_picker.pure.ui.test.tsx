import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { DevScreenLink, DevScreenPicker, type DevScreen } from './dev_screen_picker.pure.ui.tsx'

afterEach(cleanup)

const SCREENS: readonly DevScreen[] = [
  { id: 'one', label: 'First screen', Screen: () => <h1>One</h1> },
  { id: 'two', label: 'Second screen', Screen: () => <h1>Two</h1> },
]

describe('DevScreenPicker', () => {
  it('lists every screen as a link when none matches', () => {
    render(<DevScreenPicker screens={SCREENS} screen="index" />)
    const nav = screen.getByRole('navigation', { name: 'Dev screens' })
    expect(Array.from(nav.querySelectorAll('a'), (a) => a.getAttribute('href'))).toEqual(['?screen=one', '?screen=two'])
  })

  it('renders the named screen with the way back to the list', () => {
    render(<DevScreenPicker screens={SCREENS} screen="two" />)
    expect(screen.getByRole('heading', { name: 'Two' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Dev screens' }).getAttribute('href')).toBe('?screen=index')
  })

  it('the link stands alone too', () => {
    render(<DevScreenLink />)
    expect(screen.getByRole('link', { name: 'Dev screens' })).toBeTruthy()
  })
})
