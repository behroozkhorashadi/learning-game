import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { bindApp } from './app.effect.ui.tsx'
import { STUB_SCREENS } from './app_stub_screens.test.ui.tsx'

afterEach(cleanup)

function renderApp(): void {
  const App = bindApp({ screens: STUB_SCREENS, Overlay: null })
  render(<App />)
}

const press = (name: string): void => {
  fireEvent.click(screen.getByRole('button', { name }))
}
const on = (name: string): HTMLElement => screen.getByRole('region', { name })

describe('the app shell', () => {
  it('starts on the picker; picking an open profile goes home, then into a game and back', () => {
    renderApp()
    expect(on('ProfilePicker')).toBeTruthy()
    press('onSelect')
    expect(on('GamePicker').textContent).toContain('"name":"Mia"')
    press('onSelectGame')
    expect(on('PromptForge').textContent).toContain('profileId: 1')
    press('onFinished')
    expect(on('StoryLibrary')).toBeTruthy()
    press('onBack')
    expect(on('GamePicker')).toBeTruthy()
  })

  it('celebrates new badges over a player\'s screens: a party at home, a toast in a game, nothing on the picker', () => {
    renderApp()
    expect(screen.queryByRole('region', { name: 'BadgeCelebrations' })).toBeNull()
    press('onSelect')
    expect(on('BadgeCelebrations').textContent).toContain('mode: "party"')
    expect(on('BadgeCelebrations').textContent).toContain('profileId: 1')
    press('onSelectGame')
    expect(on('BadgeCelebrations').textContent).toContain('mode: "toast"')
  })

  it("the picker's pencil on a protected profile asks for the password, then edits and returns to the picker", () => {
    renderApp()
    press('onEditProfile')
    expect(on('ProfileUnlock').textContent).toContain('Nora')
    press('onUnlocked')
    expect(on('EditProfile').textContent).toContain('"kind":"profile","password":"tiger42"')
    press('onSaved')
    expect(on('ProfilePicker')).toBeTruthy()
  })

  it('creates a player and plays as them; switching player returns to the picker', () => {
    renderApp()
    press('onAddPlayer')
    press('onCreated')
    expect(on('GamePicker')).toBeTruthy()
    press('onSwitchProfile')
    expect(on('ProfilePicker')).toBeTruthy()
  })

  it('reaches admin, badges, practice settings, and the home edit, each with its way back', () => {
    renderApp()
    press('onOpenAdmin')
    press('onClose')
    expect(on('ProfilePicker')).toBeTruthy()
    press('onSelect')
    press('onViewBadges')
    expect(on('Badges').textContent).toContain('kidName: "Mia"')
    press('onBack')
    press('onOpenPracticeSettings')
    expect(on('OutbreakSettings')).toBeTruthy()
    press('onBack')
    press('onEditProfile')
    expect(on('EditProfile').textContent).toContain('"kind":"none"')
    press('onCancel')
    expect(on('GamePicker')).toBeTruthy()
  })

  it('a grown-up signs in from the picker to their dashboard, with no badge fanfare, and signs out', () => {
    renderApp()
    press('onSelectParent')
    expect(on('ParentLogin').textContent).toContain('"name":"Mom"')
    press('onSignedIn')
    expect(on('ParentDashboard').textContent).toContain('password: "mom-pw"')
    expect(screen.queryByRole('region', { name: 'BadgeCelebrations' })).toBeNull()
    press('onSignOut')
    expect(on('ProfilePicker')).toBeTruthy()
  })

  it('"I\'m a parent" from the picker or the create screen makes a parent and opens their dashboard', () => {
    renderApp()
    press('onAddParent')
    press('onCancel')
    expect(on('ProfilePicker')).toBeTruthy()
    press('onAddPlayer')
    press('onAddParent')
    expect(on('CreateParent')).toBeTruthy()
    press('onCreated')
    expect(on('ParentDashboard').textContent).toContain('password: "pw"')
  })

  it('renders the overlay over every screen', () => {
    const App = bindApp({ screens: STUB_SCREENS, Overlay: () => <a href="?screen=index">Dev screens</a> })
    render(<App />)
    expect(screen.getByRole('link', { name: 'Dev screens' })).toBeTruthy()
  })
})
