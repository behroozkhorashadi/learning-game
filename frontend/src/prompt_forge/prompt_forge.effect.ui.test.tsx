import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { manualTimers } from '@app/timing/manual_timers.test.lib.ts'
import { cardsIn } from '@app/writing/modifier_cards.pure.lib.ts'
import { StubReveal } from '@app/writing/stub_reveal.test.ui.tsx'
import { fakeWriter, fakeWritingDeps, type FakeWriter } from '@app/writing/writing_fakes.test.lib.ts'
import { words } from '@app/writing/writing_fixtures.test.lib.ts'
import { COACH_THINKING_MS, CARD_FLIP_MS } from '@app/writing/writing_game_state.pure.lib.ts'
import { bindPromptForge } from './prompt_forge.effect.ui.tsx'

afterEach(cleanup)

function renderForge(writer: FakeWriter = fakeWriter()) {
  const timers = manualTimers()
  const PromptForge = bindPromptForge({ ...fakeWritingDeps(writer, timers), IllustrationReveal: StubReveal })
  const onBack = vi.fn()
  const onFinished = vi.fn()
  render(<PromptForge profileId={1} onBack={onBack} onFinished={onFinished} />)
  const tick = (ms: number) => {
    act(() => {
      timers.advance(ms)
    })
  }
  return { writer, onBack, onFinished, tick }
}

function forgeAllIngredients(): void {
  for (const option of ['a lighthouse keeper', 'an island in fog', 'a jar of oil', 'stubborn']) fireEvent.click(screen.getByRole('button', { name: option }))
}

describe('PromptForge', () => {
  it('walks from forging through the twist into drafting without saving a piece yet', () => {
    const { writer, tick } = renderForge()
    expect(screen.getByText('The Forge')).toBeTruthy()
    forgeAllIngredients()
    fireEvent.click(screen.getByRole('button', { name: /Forge it/ }))
    expect(screen.getByText('The Twist')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Flip the twist' }))
    tick(CARD_FLIP_MS)
    fireEvent.click(screen.getByRole('button', { name: /Start writing/ }))
    expect(screen.getByText(/You forged a lighthouse keeper · an island in fog · a jar of oil · stubborn — then flipped/)).toBeTruthy()
    // Only finishing the revision pass creates a piece; abandoning here leaves no ghost story.
    expect(writer.created).toEqual([])
  })

  it('keeps you on the forging screen until all four ingredients are picked, with one reroll', () => {
    renderForge()
    fireEvent.click(screen.getByRole('button', { name: 'a lighthouse keeper' }))
    fireEvent.click(screen.getByRole('button', { name: /Forge it/ }))
    expect(screen.getByText('The Forge')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Reroll this' }))
    expect(screen.getByText('Reroll used')).toBeTruthy()
    expect(screen.getByText('a retired spy')).toBeTruthy()
  })

  it('saves the piece with its ingredients and twist after a real revision, then reveals it', async () => {
    const { writer, tick, onFinished } = renderForge()
    forgeAllIngredients()
    fireEvent.click(screen.getByRole('button', { name: /Forge it/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Flip the twist' }))
    tick(CARD_FLIP_MS)
    fireEvent.click(screen.getByRole('button', { name: /Start writing/ }))
    fireEvent.change(screen.getByLabelText('Your draft'), { target: { value: `The keeper saw it. ${words(130)}` } })
    fireEvent.click(screen.getByRole('button', { name: 'Ready to polish →' }))
    fireEvent.click(screen.getByRole('button', { name: 'Yes, polish it' }))
    tick(COACH_THINKING_MS)
    expect(screen.getByText(/How does a lighthouse keeper first notice a jar of oil/)).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Your story'), { target: { value: `The keeper noticed it. ${words(130)}` } })
    fireEvent.click(screen.getByRole('button', { name: "I'm happy with it" }))

    expect(await screen.findByText(/Illustrating piece-1: A lighthouse keeper, an island in fog/)).toBeTruthy()
    expect(screen.getByText('Hero: The keeper noticed it.')).toBeTruthy()
    const twist = cardsIn('twist')[0]
    expect(writer.created[0]).toMatchObject({ game_id: 'prompt_forge', session_id: 'session-1', constraints: ['a lighthouse keeper', 'an island in fog', 'a jar of oil', 'stubborn', twist?.name], art_style: 'storybook' })
    expect(writer.revisions[0]?.revision).toMatchObject({ changed: true })
    fireEvent.click(screen.getByRole('button', { name: 'Read it back' }))
    expect(onFinished).toHaveBeenCalled()
  })

  it('shows a failed save and stays on the coach', async () => {
    const { tick } = renderForge(fakeWriter('POST /api/pieces failed with HTTP 500'))
    forgeAllIngredients()
    fireEvent.click(screen.getByRole('button', { name: /Forge it/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Flip the twist' }))
    tick(CARD_FLIP_MS)
    fireEvent.click(screen.getByRole('button', { name: /Start writing/ }))
    fireEvent.change(screen.getByLabelText('Your draft'), { target: { value: words(130) } })
    fireEvent.click(screen.getByRole('button', { name: 'Ready to polish →' }))
    fireEvent.click(screen.getByRole('button', { name: 'Yes, polish it' }))
    tick(COACH_THINKING_MS)
    fireEvent.change(screen.getByLabelText('Your story'), { target: { value: words(131) } })
    fireEvent.click(screen.getByRole('button', { name: "I'm happy with it" }))
    expect((await screen.findByRole('alert')).textContent).toBe('Error: POST /api/pieces failed with HTTP 500')
    expect(screen.getByLabelText('Your story')).toBeTruthy()
  })

  it('calls onBack from the forging screen', () => {
    const { onBack } = renderForge()
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(onBack).toHaveBeenCalled()
  })
})
