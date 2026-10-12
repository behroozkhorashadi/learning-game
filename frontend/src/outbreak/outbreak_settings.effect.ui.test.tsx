import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PracticeConfigRecord, PracticeConfigUpsert } from '@app/api/practice_config_schema.pure.lib.ts'
import { bindOutbreakSettings } from './outbreak_settings.effect.ui.tsx'

afterEach(cleanup)

/** A practice-config API over one saved config (or none), recording what it was asked. */
function fakePracticeConfig(saved: PracticeConfigRecord | null, failGet: string | null = null) {
  const saves: PracticeConfigUpsert[] = []
  const clears: number[] = []
  return {
    saves,
    clears,
    practiceConfig: {
      get: () => (failGet === null ? Promise.resolve(saved) : Promise.reject(new Error(failGet))),
      save: (config: PracticeConfigUpsert) => {
        saves.push(config)
        return Promise.resolve()
      },
      clear: (profileId: number) => {
        clears.push(profileId)
        return Promise.resolve()
      },
    },
  }
}

async function renderSettings(saved: PracticeConfigRecord | null, failGet: string | null = null) {
  const api = fakePracticeConfig(saved, failGet)
  const OutbreakSettings = bindOutbreakSettings({ practiceConfig: api.practiceConfig })
  const onBack = vi.fn()
  render(<OutbreakSettings profileId={2} onBack={onBack} />)
  await act(async () => undefined)
  return { ...api, onBack }
}

const SAVED: PracticeConfigRecord = { profile_id: 2, game_id: 'fact_fluency', operations: ['×'], focus_numbers: { '×': [7, 8] }, difficulty: 8 }

function controls(): HTMLElement | null {
  return screen.getByText('Operations').closest('[aria-hidden]')
}

describe('OutbreakSettings: discoverability', () => {
  it('always renders the operation, focus, and difficulty controls, inert until customizing', async () => {
    await renderSettings(null)
    expect(screen.getByRole('button', { name: '×', hidden: true })).toBeTruthy()
    expect(screen.getByText(/Difficulty/)).toBeTruthy()
    expect(screen.getByRole('checkbox')).toHaveProperty('checked', false)
    expect(controls()?.getAttribute('aria-hidden')).toBe('true')
  })

  it('checking the box makes the controls live', async () => {
    await renderSettings(null)
    fireEvent.click(screen.getByRole('checkbox'))
    expect(controls()?.getAttribute('aria-hidden')).toBe('false')
  })
})

describe('OutbreakSettings: operations', () => {
  it('never deselects the last operation, and shows focus numbers only for active ones', async () => {
    await renderSettings(null)
    fireEvent.click(screen.getByRole('checkbox'))
    for (const op of ['+', '-', '÷', '×']) fireEvent.click(screen.getByRole('button', { name: op }))
    expect(screen.getByRole('button', { name: '×' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('group', { name: 'Focus numbers for multiplication' })).toBeTruthy()
    expect(screen.queryByRole('group', { name: 'Focus numbers for addition' })).toBeNull()
  })
})

describe('OutbreakSettings: a saved config', () => {
  it('prefills the form, already customized', async () => {
    await renderSettings(SAVED)
    expect(screen.getByRole('checkbox')).toHaveProperty('checked', true)
    expect(screen.getByRole('button', { name: '×' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: '7' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: '8' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByText(/8\/12/)).toBeTruthy()
  })

  it('shows a load failure but still offers the form', async () => {
    await renderSettings(null, 'GET /api/practice-config failed with HTTP 500')
    expect(screen.getByRole('alert').textContent).toBe('GET /api/practice-config failed with HTTP 500')
    expect(screen.getByRole('checkbox')).toBeTruthy()
  })
})

describe('OutbreakSettings: saving', () => {
  it('saves the chosen operations, focus numbers, and difficulty, then goes back', async () => {
    const { saves, onBack } = await renderSettings(null)
    fireEvent.click(screen.getByRole('checkbox'))
    for (const op of ['+', '-', '÷']) fireEvent.click(screen.getByRole('button', { name: op }))
    fireEvent.click(screen.getByRole('button', { name: '7' }))
    fireEvent.click(screen.getByRole('button', { name: '8' }))
    fireEvent.change(screen.getByRole('slider'), { target: { value: '3' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => {
      expect(onBack).toHaveBeenCalled()
    })
    expect(saves).toEqual([{ profile_id: 2, game_id: 'fact_fluency', operations: ['×'], focus_numbers: { '×': [7, 8] }, difficulty: 3 }])
  })

  it('clears saved settings when customizing is turned off', async () => {
    const { clears, saves, onBack } = await renderSettings(SAVED)
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => {
      expect(onBack).toHaveBeenCalled()
    })
    expect(clears).toEqual([2])
    expect(saves).toEqual([])
  })

  it('saves nothing when it was never customized', async () => {
    const { clears, saves, onBack } = await renderSettings(null)
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => {
      expect(onBack).toHaveBeenCalled()
    })
    expect([saves, clears]).toEqual([[], []])
  })
})
