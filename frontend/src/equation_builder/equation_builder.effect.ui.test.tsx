import { cleanup, fireEvent, render, screen, waitForElementToBeRemoved, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fakePractice } from '@app/practice/practice_fakes.test.lib.ts'
import { bindEquationBuilder } from './equation_builder.effect.ui.tsx'
import { SESSION_EQUATIONS } from './equation_fixtures.test.lib.ts'
import { EQUATION_GAME_ID } from './equation_item.pure.lib.ts'

afterEach(cleanup)

function renderGame() {
  const practice = fakePractice(EQUATION_GAME_ID, SESSION_EQUATIONS)
  const EquationBuilder = bindEquationBuilder({ practice: practice.deps, speech: { speakText: vi.fn(), speakWord: vi.fn() } })
  render(<EquationBuilder profileId={1} onBack={vi.fn()} />)
  return practice
}

async function placeAndCheck(label: string): Promise<void> {
  const tray = within(await screen.findByRole('group', { name: 'Number tiles' }))
  const tile = tray.getByRole('button', { name: label })
  fireEvent.pointerDown(tile, { pointerId: 1, clientX: 0, clientY: 0 })
  fireEvent.pointerUp(tile, { pointerId: 1, clientX: 0, clientY: 0 })
  fireEvent.click(screen.getByRole('button', { name: /Check it/ }))
  await screen.findByText('You built it!')
}

describe('EquationBuilder', () => {
  it('reaches the wrap-up after 5 correct answers, with no handoff or verify step', async () => {
    const practice = renderGame()
    fireEvent.click(screen.getByRole('button', { name: 'Start' }))
    for (const [round, eq] of SESSION_EQUATIONS.entries()) {
      expect(await screen.findByRole('img', { name: 'missing' })).toBeTruthy()
      await placeAndCheck(String(eq.answer))
      if (round === SESSION_EQUATIONS.length - 1) break
      fireEvent.click(screen.getByRole('button', { name: 'Play again' }))
      await waitForElementToBeRemoved(() => screen.queryByText('You built it!'))
    }
    expect(await screen.findByText('You solved them all!')).toBeTruthy()
    expect(screen.getByText('3 + 4 = 7')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'I wrote it' })).toBeNull()
    expect(practice.attempts[0]?.details).toEqual({ placement: ['7-0'], missing: 'answer' })
  })

  it('a wrong tile is recorded but does not count', async () => {
    const practice = renderGame()
    fireEvent.click(screen.getByRole('button', { name: 'Start' }))
    const tray = within(await screen.findByRole('group', { name: 'Number tiles' }))
    const tile = tray.getByRole('button', { name: '8' })
    fireEvent.pointerDown(tile, { pointerId: 1, clientX: 0, clientY: 0 })
    fireEvent.pointerUp(tile, { pointerId: 1, clientX: 0, clientY: 0 })
    fireEvent.click(screen.getByRole('button', { name: /Check it/ }))
    expect(await screen.findByText('Almost! Take another look.')).toBeTruthy()
    expect(practice.attempts[0]?.telemetry.correct).toBe(false)
    expect(screen.getByLabelText('Item 1 of 5')).toBeTruthy()
  })
})
