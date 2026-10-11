import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { bindDevScreens, type DevScreensDeps } from './dev_screens.effect.ui.tsx'

afterEach(cleanup)

const NONE = (): null => null

function deps(overrides: Partial<DevScreensDeps> = {}): DevScreensDeps {
  return {
    standalone: [{ id: 'todo-example', label: 'Todos', Screen: NONE }],
    speech: { speakText: vi.fn(), speakWord: vi.fn() },
    log: vi.fn(),
    ProfilePicker: NONE,
    CreateProfile: NONE,
    AdminPanel: NONE,
    GamePicker: NONE,
    OutbreakSettings: NONE,
    SyllableBuilder: NONE,
    ZombieMathBlaster: NONE,
    ZombieHorde: NONE,
    ZombiePOCScene: NONE,
    ZombieHitLab: NONE,
    WeaponPOCScene: NONE,
    Badges: NONE,
    StoryLibrary: NONE,
    StorybookEntryCard: NONE,
    PathfinderMapBuilder: NONE,
    PathfinderLevelGallery: NONE,
    IllustrationReveal: NONE,
    ModifierDeck: NONE,
    ...overrides,
  }
}

describe('bindDevScreens', () => {
  it('puts the standalone screens first', () => {
    expect(bindDevScreens(deps())[0]?.id).toBe('todo-example')
  })

  it('wires the demos to the injected speech and log', () => {
    const d = deps()
    const entry = bindDevScreens(d).find((s) => s.id === 'handoff-pencil')
    if (entry === undefined) throw new Error('no handoff screen')
    render(<entry.Screen />)
    fireEvent.click(screen.getByRole('button', { name: 'Hear the word' }))
    fireEvent.click(screen.getByRole('button', { name: 'I wrote it' }))
    expect(d.speech.speakWord).toHaveBeenCalledWith('tomato')
    expect(d.log).toHaveBeenCalledWith('onWroteIt')
  })

  it('renders a bound screen with mock props', () => {
    const Badges = vi.fn((props: { readonly kidName: string }) => <p>{props.kidName}</p>)
    const entry = bindDevScreens(deps({ Badges })).find((s) => s.id === 'badges')
    if (entry === undefined) throw new Error('no badges screen')
    render(<entry.Screen />)
    expect(screen.getByText('Mia')).toBeTruthy()
  })
})
