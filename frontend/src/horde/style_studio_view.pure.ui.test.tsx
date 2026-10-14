import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LOADING, loaded } from '@app/query/query_state.pure.lib.ts'
import { DEFAULT_LOOKS, gearLookFor } from './horde_looks.pure.lib.ts'
import { StyleStudioView, type StyleStudioViewProps, type UnlockOffer } from './style_studio_view.pure.ui.tsx'

afterEach(cleanup)

const offer = (id: string, name: string, owned: boolean): UnlockOffer => ({ id, name, description: `${name}, described.`, price: 100, owned })

function props(overrides: Partial<StyleStudioViewProps> = {}): StyleStudioViewProps {
  return {
    balance: 120,
    unlocks: { suitPaint: offer('suit_paint', 'Suit Paint Studio', true), blasterPaint: offer('blaster_paint', 'Blaster Paint', false), emblem: offer('emblem_maker', 'Emblem Maker', true), pathfinder: null, horde: offer('horde_billboard', 'Horde Billboard', true) },
    looks: DEFAULT_LOOKS,
    preview: gearLookFor({ looks: DEFAULT_LOOKS, pictures: {} }, []),
    gallery: loaded([]),
    buying: null,
    dirty: false,
    saving: false,
    saved: false,
    error: null,
    onChange: vi.fn(),
    onBuy: vi.fn(),
    onSave: vi.fn(),
    onBack: vi.fn(),
    ...overrides,
  }
}

describe('StyleStudioView', () => {
  it('shows the controls of unlocked parts, an Unlock button on locked ones, and nothing for parts not sold', () => {
    const onBuy = vi.fn()
    render(<StyleStudioView {...props({ onBuy })} />)
    expect(within(screen.getByRole('region', { name: 'Suit paint' })).getByRole('group', { name: 'Suit colour' })).toBeTruthy()
    const blaster = within(screen.getByRole('region', { name: 'Blaster paint' }))
    expect(blaster.queryByRole('group')).toBeNull()
    fireEvent.click(blaster.getByRole('button', { name: 'Unlock Blaster Paint for 100 points' }))
    expect(onBuy).toHaveBeenCalledWith('blaster_paint')
    expect(screen.queryByRole('region', { name: 'Pathfinder backdrop' })).toBeNull()
  })

  it('reports each change as a whole new look', () => {
    const onChange = vi.fn()
    render(<StyleStudioView {...props({ onChange })} />)
    fireEvent.click(within(screen.getByRole('group', { name: 'Suit colour' })).getByRole('button', { name: 'Blue' }))
    expect(onChange).toHaveBeenLastCalledWith({ ...DEFAULT_LOOKS, suit_paint: { color: '#1E66F5', shine: 'shiny' } })
    fireEvent.click(screen.getByRole('button', { name: 'crown emblem' }))
    expect(onChange).toHaveBeenLastCalledWith({ ...DEFAULT_LOOKS, emblem: { symbol: 'crown', art_id: null, color: '#FFAA00', place: 'both' } })
  })

  it('holds the finish until there is paint, and offers the emblem colour and place once there is an emblem', () => {
    const onChange = vi.fn()
    const looks = { ...DEFAULT_LOOKS, emblem: { symbol: 'paw', art_id: null, color: '#FFAA00', place: 'both' } } as const
    render(<StyleStudioView {...props({ onChange, looks })} />)
    expect(screen.getByRole('button', { name: 'Glowing' }).hasAttribute('disabled')).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'On my blaster' }))
    expect(onChange).toHaveBeenLastCalledWith({ ...looks, emblem: { ...looks.emblem, place: 'blaster' } })
    expect(screen.getByRole('button', { name: 'paw emblem' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('waits for the gallery before offering art', () => {
    render(<StyleStudioView {...props({ gallery: LOADING })} />)
    expect(within(screen.getByRole('region', { name: 'Horde billboard' })).getByText('Opening your gallery…')).toBeTruthy()
  })

  it('saves, says when it is saved, and shows a refusal', () => {
    const onSave = vi.fn()
    render(<StyleStudioView {...props({ onSave, dirty: true })} />)
    fireEvent.click(screen.getByRole('button', { name: 'Save my look' }))
    expect(onSave).toHaveBeenCalledTimes(1)
    cleanup()
    render(<StyleStudioView {...props({ saved: true, error: null })} />)
    expect(screen.getByText('✓ Saved! Your new look is on.')).toBeTruthy()
    cleanup()
    render(<StyleStudioView {...props({ error: 'that look needs it first' })} />)
    expect(screen.getByRole('alert').textContent).toBe('that look needs it first')
  })
})
