import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { assembleEquationBuilder } from './equation_builder.assembly.main.ts'

/** The real graph: assembled game → practice adapter → (stubbed) global fetch. */

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('assembleEquationBuilder', () => {
  it('loads an equation item and shows its tiles', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify({ item_id: 'i1', game_id: 'equation_builder', level: 1, payload: { left: 2, operator: '+', right: 2, answer: 4, missing: 'answer', tiles: ['4', '5'] } }), { status: 200 }))))
    const EquationBuilder = assembleEquationBuilder()
    render(<EquationBuilder profileId={4} onBack={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Start' }))
    expect(await screen.findByRole('button', { name: '5' })).toBeTruthy()
  })
})
