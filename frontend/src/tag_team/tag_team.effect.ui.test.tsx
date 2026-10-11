import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { manualTimers } from '@app/timing/manual_timers.test.lib.ts'
import { StubReveal } from '@app/writing/stub_reveal.test.ui.tsx'
import { fakeWriter, fakeWritingDeps } from '@app/writing/writing_fakes.test.lib.ts'
import { COACH_THINKING_MS } from '@app/writing/writing_game_state.pure.lib.ts'
import { bindTagTeam } from './tag_team.effect.ui.tsx'

afterEach(cleanup)

const AI_TURN_MS = 900

function renderGame() {
  const timers = manualTimers()
  const writer = fakeWriter()
  // random 0: the first ghost variant, "The Eighth Floor".
  const TagTeam = bindTagTeam({ ...fakeWritingDeps(writer, timers, () => 0), IllustrationReveal: StubReveal })
  const onBack = vi.fn()
  render(<TagTeam profileId={1} onBack={onBack} onFinished={vi.fn()} />)
  const tick = (ms: number) => {
    act(() => {
      timers.advance(ms)
    })
  }
  return { writer, onBack, tick, timers }
}

function writeLine(text: string): void {
  fireEvent.change(screen.getByLabelText('Your line'), { target: { value: text } })
  fireEvent.click(screen.getByRole('button', { name: 'Pass it back →' }))
}

function playFourLineGame(tick: (ms: number) => void): void {
  fireEvent.click(screen.getByRole('button', { name: '4 lines' }))
  fireEvent.click(screen.getByRole('button', { name: "I'll start us off →" }))
  expect(screen.getByText('thinking of one line…')).toBeTruthy()
  tick(AI_TURN_MS)
  writeLine('I pressed it because nobody was watching the hallway.')
  expect(screen.queryByLabelText('Your line')).toBeNull()
  tick(AI_TURN_MS)
  writeLine('I knocked back twice and the hallway went completely silent.')
}

describe('TagTeamStory', () => {
  it('plays a full four-line game to the assembly screen without saving a piece yet', () => {
    const { writer, tick } = renderGame()
    playFourLineGame(tick)
    expect(screen.getByText('The Eighth Floor')).toBeTruthy()
    expect(screen.getByText('4 lines, one story')).toBeTruthy()
    // The kid wrote 19 of the 50 words across the four lines.
    expect(screen.getByText('38%')).toBeTruthy()
    expect(writer.created).toEqual([])
  })

  it('does not let the kid pass back a line that is too short', () => {
    const { tick } = renderGame()
    fireEvent.click(screen.getByRole('button', { name: '4 lines' }))
    fireEvent.click(screen.getByRole('button', { name: "I'll start us off →" }))
    tick(AI_TURN_MS)
    writeLine('too short')
    expect(screen.getByLabelText('Your line')).toBeTruthy()
  })

  it('saves the story with every turn in order after a revision', async () => {
    const { writer, tick } = renderGame()
    playFourLineGame(tick)
    fireEvent.click(screen.getByRole('button', { name: 'Polish it together →' }))
    tick(COACH_THINKING_MS)
    const story = screen.getByLabelText('Your story')
    if (!(story instanceof HTMLTextAreaElement)) throw new Error('expected the story textarea')
    fireEvent.change(story, { target: { value: `${story.value} The end.` } })
    fireEvent.click(screen.getByRole('button', { name: "I'm happy with it" }))
    expect(await screen.findByText(/Illustrating piece-1: The Eighth Floor/)).toBeTruthy()
    expect(writer.turns.map((t) => [t.author, t.order])).toEqual([
      ['ai', 0],
      ['kid', 1],
      ['ai', 2],
      ['kid', 3],
    ])
  })

  it('stops the AI turn if the game is left mid-thread', () => {
    const { timers } = renderGame()
    fireEvent.click(screen.getByRole('button', { name: "I'll start us off →" }))
    cleanup()
    expect(timers.pending()).toBe(0)
  })

  it('calls onBack from the setup screen', () => {
    const { onBack } = renderGame()
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(onBack).toHaveBeenCalled()
  })
})
