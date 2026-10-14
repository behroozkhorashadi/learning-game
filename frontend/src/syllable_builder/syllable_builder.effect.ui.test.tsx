import { cleanup, fireEvent, render, screen, waitForElementToBeRemoved, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fakePractice } from '@app/practice/practice_fakes.test.lib.ts'
import type { Speech } from '@app/speech/speech_state.pure.lib.ts'
import { bindSyllableBuilder } from './syllable_builder.effect.ui.tsx'
import { SESSION_WORDS } from './syllable_fixtures.test.lib.ts'
import { SYLLABLE_GAME_ID } from './syllable_item.pure.lib.ts'

afterEach(cleanup)

function renderGame(payloads = SESSION_WORDS) {
  const practice = fakePractice(SYLLABLE_GAME_ID, payloads)
  const speech: Speech = { speakText: vi.fn(), stopSpeaking: vi.fn(), speakWord: vi.fn() }
  const SyllableBuilder = bindSyllableBuilder({ practice: practice.deps, speech })
  const onBack = vi.fn()
  render(<SyllableBuilder profileId={1} profileName="Mia" onBack={onBack} />)
  return { practice, speech, onBack }
}

function tap(el: HTMLElement): void {
  fireEvent.pointerDown(el, { pointerId: 1, clientX: 0, clientY: 0 })
  fireEvent.pointerUp(el, { pointerId: 1, clientX: 0, clientY: 0 })
}

async function placeAndCheck(): Promise<void> {
  const tray = within(await screen.findByRole('group', { name: 'Sound tiles' }))
  tap(tray.getByRole('button', { name: 'a' }))
  tap(tray.getByRole('button', { name: 'b' }))
  fireEvent.click(screen.getByRole('button', { name: /Check it/ }))
  await screen.findByText('You built it!')
}

describe('SyllableBuilder', () => {
  it('reaches the wrap-up after 5 correct answers, even with a repeated word, through handoff and parent verify', async () => {
    const { practice } = renderGame()
    fireEvent.click(screen.getByRole('button', { name: 'Start' }))
    for (let round = 0; round < SESSION_WORDS.length - 1; round++) {
      await placeAndCheck()
      fireEvent.click(screen.getByRole('button', { name: 'Play again' }))
      // The old board stays until the next item arrives and its key changes.
      await waitForElementToBeRemoved(() => screen.queryByText('You built it!'))
    }
    await placeAndCheck()

    fireEvent.click(await screen.findByRole('button', { name: 'I wrote it' }))
    for (const digit of ['1', '2', '3', '4']) fireEvent.click(screen.getByRole('button', { name: digit }))
    expect(screen.getByText('Did Mia write it correctly?')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Correct' }))

    expect(await screen.findByText('You built them all!')).toBeTruthy()
    expect(practice.verifications).toEqual([{ attemptId: 5, correct: true }])
    expect(practice.attempts.map((a) => a.details)).toContainEqual({ assembled: ['a-0', 'b-1'] })
    fireEvent.click(screen.getByRole('button', { name: '4 stars' }))
    expect(practice.ratings).toEqual([4])
  })

  it('reads the instructions (stopping them on Start) and the word aloud', async () => {
    const { speech } = renderGame()
    fireEvent.click(screen.getByRole('button', { name: 'Hear how to play' }))
    expect(speech.speakText).toHaveBeenCalledWith(expect.stringContaining('Slide the sounds together'), expect.any(Function))
    expect(speech.stopSpeaking).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Start' }))
    // Starting cuts the instructions off.
    expect(speech.stopSpeaking).toHaveBeenCalledTimes(1)
    fireEvent.click(await screen.findByRole('button', { name: 'Hear the word' }))
    expect(speech.speakWord).toHaveBeenCalledWith('elephant')
  })

  it('shows the word picture and counts progress', async () => {
    renderGame()
    fireEvent.click(screen.getByRole('button', { name: 'Start' }))
    expect(await screen.findByRole('img', { name: 'elephant' })).toBeTruthy()
    await placeAndCheck()
    expect(await screen.findByText(/^Recorded \(event evt-0000/)).toBeTruthy()
  })

  it('goes back from the start screen', () => {
    const { onBack } = renderGame()
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(onBack).toHaveBeenCalled()
  })
})
