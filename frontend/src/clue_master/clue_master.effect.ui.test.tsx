import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { manualTimers } from '@app/timing/manual_timers.test.lib.ts'
import { StubReveal } from '@app/writing/stub_reveal.test.ui.tsx'
import { fakeWriter, fakeWritingDeps } from '@app/writing/writing_fakes.test.lib.ts'
import { CARD_FLIP_MS, COACH_THINKING_MS } from '@app/writing/writing_game_state.pure.lib.ts'
import { GUESS_READING_MS } from './case_files.pure.lib.ts'
import { bindClueMaster } from './clue_master.effect.ui.tsx'

afterEach(cleanup)

const LONG_DRAFT =
  'The house had been quiet all afternoon and nobody thought much of the empty hallway until the rain started outside. ' +
  'Footsteps came and went upstairs but no one answered when called out to twice. ' +
  'By evening the whole family had gathered in the kitchen wondering out loud who had actually been home.'

function renderGame() {
  const timers = manualTimers()
  const writer = fakeWriter()
  // random 0: the first case, "The Wet Umbrella".
  const ClueMaster = bindClueMaster({ ...fakeWritingDeps(writer, timers, () => 0), IllustrationReveal: StubReveal })
  const onBack = vi.fn()
  const onFinished = vi.fn()
  render(<ClueMaster profileId={1} onBack={onBack} onFinished={onFinished} />)
  const tick = (ms: number) => {
    act(() => {
      timers.advance(ms)
    })
  }
  return { writer, onBack, onFinished, tick }
}

function reachRevising(tick: (ms: number) => void, draft = LONG_DRAFT): void {
  fireEvent.click(screen.getByRole('button', { name: 'Deal my ending' }))
  tick(CARD_FLIP_MS)
  fireEvent.click(screen.getByRole('button', { name: 'Start writing →' }))
  fireEvent.change(screen.getByLabelText('Your draft'), { target: { value: draft } })
  fireEvent.click(screen.getByRole('button', { name: 'Let me guess →' }))
}

describe('ClueMaster', () => {
  it('deals a case, drafts, and reaches revising without saving a piece yet', () => {
    const { writer, tick } = renderGame()
    reachRevising(tick)
    expect(screen.getByText('Give me a second…')).toBeTruthy()
    expect(writer.created).toEqual([])
  })

  it('does not let the kid guess before writing enough of the lead-up', () => {
    const { tick } = renderGame()
    reachRevising(tick, 'too short a lead-up')
    expect(screen.getByLabelText('Your draft')).toBeTruthy()
  })

  it('creates the piece only after the revision pass, then plays through to a verdict and the reveal', async () => {
    const { writer, tick } = renderGame()
    reachRevising(tick)
    tick(COACH_THINKING_MS)
    fireEvent.change(screen.getByLabelText('Your story'), { target: { value: `${LONG_DRAFT} It never happened again.` } })
    fireEvent.click(screen.getByRole('button', { name: "I'm happy with it" }))

    expect(await screen.findByText('reading it back…')).toBeTruthy()
    expect(writer.created[0]).toMatchObject({ game_id: 'clue_master', title: 'The Wet Umbrella', constraints: ['The Wet Umbrella'] })
    tick(GUESS_READING_MS)
    fireEvent.click(screen.getByRole('button', { name: 'You got it' }))
    expect(screen.getByText('Solved')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Draw my story →' }))
    expect(screen.getByText(/Illustrating piece-1: The Wet Umbrella/)).toBeTruthy()
    // The hero is the last sentence: the dealt ending the story lands on.
    expect(screen.getByText('Hero: It never happened again.')).toBeTruthy()
  })

  it('deals a different ending on request, and "Play it again" starts a fresh round', async () => {
    const { tick } = renderGame()
    fireEvent.click(screen.getByRole('button', { name: 'Deal my ending' }))
    tick(CARD_FLIP_MS)
    fireEvent.click(screen.getByRole('button', { name: 'Deal a different ending' }))
    expect(screen.queryByText('The Wet Umbrella')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Start writing →' }))
    fireEvent.change(screen.getByLabelText('Your draft'), { target: { value: LONG_DRAFT } })
    fireEvent.click(screen.getByRole('button', { name: 'Let me guess →' }))
    tick(COACH_THINKING_MS)
    fireEvent.change(screen.getByLabelText('Your story'), { target: { value: `${LONG_DRAFT} Fin.` } })
    fireEvent.click(screen.getByRole('button', { name: "I'm happy with it" }))
    await screen.findByText('reading it back…')
    tick(GUESS_READING_MS)
    fireEvent.click(screen.getByRole('button', { name: 'Nope — not even close' }))
    fireEvent.click(screen.getByRole('button', { name: 'Play it again' }))
    expect(screen.getByRole('button', { name: 'Deal my ending' })).toBeTruthy()
  })

  it('calls onBack from the dealing screen', () => {
    const { onBack } = renderGame()
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(onBack).toHaveBeenCalled()
  })
})
