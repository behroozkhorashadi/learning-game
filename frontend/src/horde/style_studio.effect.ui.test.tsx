import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { ReactElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ArmoryLooksRecord, ArtPieceRecord } from '@app/api/armory_schema.pure.lib.ts'
import { fakeArmory, type FakeArmory } from './horde_fakes.test.ui.tsx'
import { DEFAULT_LOOKS, symbolEmblemUrl } from './horde_looks.pure.lib.ts'
import { bindStyleStudio } from './style_studio.effect.ui.tsx'

afterEach(cleanup)

async function settle(): Promise<void> {
  await act(async () => undefined)
}

const press = (name: string): void => {
  fireEvent.click(screen.getByRole('button', { name }))
}

const pick = (group: string, name: string): void => {
  fireEvent.click(within(screen.getByRole('group', { name: group })).getByRole('button', { name }))
}

const ART: readonly ArtPieceRecord[] = [
  { id: 'art-1', profile_id: 1, image_url: '/static/armory-art/art-1.jpg', style: 'comic_hero', idea: 'a dragon', created_at: '2026-10-11T12:00:00Z' },
  { id: 'art-2', profile_id: 1, image_url: '/static/armory-art/art-2.jpg', style: 'pixel_hero', idea: '', created_at: '2026-10-11T12:00:00Z' },
]

const ALL_UNLOCKS = ['suit_paint', 'blaster_paint', 'emblem_maker', 'pathfinder_frame', 'horde_billboard']

/** The studio over a fake armory; the armory prop is re-read after a purchase, as the game does. */
async function open(armory: FakeArmory): Promise<{ readonly onSaved: ReturnType<typeof vi.fn>; readonly onBack: ReturnType<typeof vi.fn> }> {
  const StyleStudio = bindStyleStudio({ looks: armory.looks, saveLooks: armory.saveLooks, gallery: armory.gallery, purchase: armory.purchase })
  const onSaved = vi.fn()
  const onBack = vi.fn()
  const view = (): ReactElement => <StyleStudio profileId={1} armory={armory.state()} onSpent={rerenderWithNewArmory} onSaved={onSaved} onBack={onBack} />
  const { rerender } = render(view())
  function rerenderWithNewArmory(): void {
    rerender(view())
  }
  await settle()
  return { onSaved, onBack }
}

describe('StyleStudio', () => {
  it('shows each part locked with its price, and unlocks one with points', async () => {
    const armory = fakeArmory({ balance: 200 })
    await open(armory)
    expect(screen.getByRole('status', { name: 'Points' }).textContent).toContain('200')
    expect(within(screen.getByRole('region', { name: 'Suit paint' })).queryByRole('group')).toBeNull()
    press('Unlock Suit Paint Studio for 150 points')
    await settle()
    expect(armory.state().owned).toContain('suit_paint')
    expect(screen.getByRole('status', { name: 'Points' }).textContent).toContain('50')
    expect(within(screen.getByRole('region', { name: 'Suit paint' })).getByRole('group', { name: 'Suit colour' })).toBeTruthy()
    // 50 points left: nothing else can be afforded.
    press('Unlock Blaster Paint for 150 points')
    await settle()
    expect(armory.state().owned).not.toContain('blaster_paint')
  })

  it('designs a whole look, previews it, and saves it only on Save', async () => {
    const armory = fakeArmory({ owned: ALL_UNLOCKS, art: ART })
    const { onSaved } = await open(armory)
    // Nothing changed yet: nothing to save.
    press('Save my look')
    await settle()
    expect(onSaved).not.toHaveBeenCalled()
    pick('Suit colour', 'Teal')
    press('Matte')
    fireEvent.change(screen.getByLabelText('Blaster colour: any colour'), { target: { value: '#abcdef' } })
    pick('Emblem symbol', 'rocket emblem')
    pick('Emblem colour', 'Purple')
    press('On my arm')
    pick('Pathfinder backdrop art', 'Comic Hero: a dragon')
    pick('Horde billboard art', 'Pixel Hero')
    expect(armory.savedLooks()).toEqual(DEFAULT_LOOKS)
    const preview = screen.getByRole('img', { name: 'Your gear' })
    expect(preview.querySelector('image')?.getAttribute('href')).toBe(symbolEmblemUrl('rocket', '#7E57C2'))
    press('Save my look')
    await settle()
    const expected: ArmoryLooksRecord = {
      skin_id: null,
      suit_paint: { color: '#00897B', shine: 'matte' },
      blaster_color: '#abcdef',
      emblem: { symbol: 'rocket', art_id: null, color: '#7E57C2', place: 'arm' },
      hung: { pathfinder: 'art-1', horde: 'art-2' },
    }
    expect(armory.savedLooks()).toEqual(expected)
    expect(onSaved).toHaveBeenCalledTimes(1)
    expect(screen.getByText('✓ Saved! Your new look is on.')).toBeTruthy()
  })

  it('starts from the saved looks, and takes things off again', async () => {
    const saved: ArmoryLooksRecord = { skin_id: null, suit_paint: { color: '#E53935', shine: 'glow' }, blaster_color: '#222222', emblem: { symbol: null, art_id: 'art-1', color: '#FFAA00', place: 'both' }, hung: { pathfinder: 'art-1', horde: null } }
    const armory = fakeArmory({ owned: ALL_UNLOCKS, art: ART, looks: saved })
    await open(armory)
    expect(within(screen.getByRole('group', { name: 'Suit colour' })).getByRole('button', { name: 'Red' }).getAttribute('aria-pressed')).toBe('true')
    expect(within(screen.getByRole('group', { name: 'Emblem art' })).getByRole('button', { name: 'Comic Hero: a dragon' }).getAttribute('aria-pressed')).toBe('true')
    press('Wear my skin instead')
    press('Original finish')
    press('No emblem')
    pick('Pathfinder backdrop art', 'Nothing')
    press('Save my look')
    await settle()
    expect(armory.savedLooks()).toEqual(DEFAULT_LOOKS)
  })

  it('says what went wrong when a save is refused, and keeps the design', async () => {
    const armory = fakeArmory({ owned: ['suit_paint'] })
    const StyleStudio = bindStyleStudio({ looks: armory.looks, saveLooks: () => Promise.reject(new Error("that look needs 'suit_paint' first")), gallery: armory.gallery, purchase: armory.purchase })
    render(<StyleStudio profileId={1} armory={armory.state()} onSpent={vi.fn()} onSaved={vi.fn()} onBack={vi.fn()} />)
    await settle()
    pick('Suit colour', 'Lime')
    press('Save my look')
    await settle()
    expect(screen.getByRole('alert').textContent).toContain("needs 'suit_paint' first")
    expect(within(screen.getByRole('group', { name: 'Suit colour' })).getByRole('button', { name: 'Lime' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('asks for art first when the gallery is empty', async () => {
    await open(fakeArmory({ owned: ['pathfinder_frame'] }))
    expect(within(screen.getByRole('region', { name: 'Pathfinder backdrop' })).getByText('Make some art in the Art Studio first, then hang it here!')).toBeTruthy()
  })

  it("says so when the looks can't load, and goes back", async () => {
    const armory = fakeArmory()
    const StyleStudio = bindStyleStudio({ looks: () => Promise.reject(new Error('GET looks failed with HTTP 500')), saveLooks: armory.saveLooks, gallery: armory.gallery, purchase: armory.purchase })
    const onBack = vi.fn()
    render(<StyleStudio profileId={1} armory={armory.state()} onSpent={vi.fn()} onSaved={vi.fn()} onBack={onBack} />)
    await settle()
    expect(screen.getByRole('alert').textContent).toContain('HTTP 500')
    press('Back')
    expect(onBack).toHaveBeenCalledTimes(1)
  })
})
