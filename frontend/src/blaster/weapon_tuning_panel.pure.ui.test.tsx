import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_WEAPON_VIEW } from './blaster_config.pure.lib.ts'
import { WeaponTuningPanel, type WeaponTuningPanelProps } from './weapon_tuning_panel.pure.ui.tsx'

afterEach(cleanup)

function renderPanel(overrides: Partial<WeaponTuningPanelProps> = {}): WeaponTuningPanelProps {
  const props: WeaponTuningPanelProps = {
    value: DEFAULT_WEAPON_VIEW,
    onChange: vi.fn(),
    hideRightArm: false,
    onHideRightArmChange: vi.fn(),
    hideLeftArm: false,
    onHideLeftArmChange: vi.fn(),
    copyText: vi.fn(() => Promise.resolve()),
    ...overrides,
  }
  render(<WeaponTuningPanel {...props} />)
  return props
}

describe('WeaponTuningPanel', () => {
  it('edits a pose value with its slider or its number box', () => {
    const props = renderPanel()
    fireEvent.change(screen.getByRole('slider', { name: 'Weapon Scale' }), { target: { value: '0.5' } })
    expect(props.onChange).toHaveBeenLastCalledWith({ ...DEFAULT_WEAPON_VIEW, weaponScale: 0.5 })
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Left arm Cocking travel value' }), { target: { value: '0.2' } })
    expect(props.onChange).toHaveBeenLastCalledWith({ ...DEFAULT_WEAPON_VIEW, cockingSlideDistance: 0.2 })
  })

  it('hides either arm', () => {
    const props = renderPanel()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Hide right arm' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Hide left arm' }))
    expect([props.onHideRightArmChange, props.onHideLeftArmChange].map((f) => vi.mocked(f).mock.calls)).toEqual([[[true]], [[true]]])
  })

  it('copies the config snippet and says so until the pose changes', async () => {
    const props = renderPanel()
    fireEvent.click(screen.getByRole('button', { name: 'Copy config snippet' }))
    await act(async () => undefined)
    expect(props.copyText).toHaveBeenCalledWith(expect.stringContaining('export const DEFAULT_WEAPON_VIEW'))
    expect(screen.getByRole('button', { name: 'Copied!' })).toBeTruthy()
    cleanup()
    render(<WeaponTuningPanel {...props} value={{ ...DEFAULT_WEAPON_VIEW, weaponScale: 0.9 }} />)
    expect(screen.getByRole('button', { name: 'Copy config snippet' })).toBeTruthy()
  })

  it('a denied clipboard is not an error: the snippet is on screen anyway', async () => {
    renderPanel({ copyText: () => Promise.reject(new Error('denied')) })
    fireEvent.click(screen.getByRole('button', { name: 'Copy config snippet' }))
    await act(async () => undefined)
    expect(screen.getByRole('button', { name: 'Copy config snippet' })).toBeTruthy()
    expect(screen.getByText(/weaponScale:/)).toBeTruthy()
  })
})
