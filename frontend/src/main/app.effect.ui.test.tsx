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

  it('renders the overlay over every screen', () => {
    const App = bindApp({ screens: STUB_SCREENS, Overlay: () => <a href="?screen=index">Dev screens</a> })
    render(<App />)
    expect(screen.getByRole('link', { name: 'Dev screens' })).toBeTruthy()
  })
})
