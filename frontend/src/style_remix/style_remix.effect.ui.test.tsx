import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { manualTimers } from '@app/timing/manual_timers.test.lib.ts'
import { StubReveal } from '@app/writing/stub_reveal.test.ui.tsx'
import { fakeWriter, fakeWritingDeps } from '@app/writing/writing_fakes.test.lib.ts'
import { CARD_FLIP_MS, COACH_THINKING_MS } from '@app/writing/writing_game_state.pure.lib.ts'
import { bindStyleRemix } from './style_remix.effect.ui.tsx'

afterEach(cleanup)

const REMIX = 'The gate creaked open in the storm and something small slipped away into the dark rain.'

function renderLab() {
  const timers = manualTimers()
  const writer = fakeWriter()
  const StyleRemix = bindStyleRemix({ ...fakeWritingDeps(writer, timers, () => 0), IllustrationReveal: StubReveal })
  const onBack = vi.fn()
  render(<StyleRemix profileId={1} onBack={onBack} onFinished={vi.fn()} />)
  const tick = (ms: number) => {
    act(() => {
      timers.advance(ms)
    })
  }
  return { writer, onBack, tick }
}

function shelveAVersion(tick: (ms: number) => void, text = REMIX): void {
  fireEvent.click(screen.getByRole('button', { name: 'Draw a style' }))
  tick(CARD_FLIP_MS)
  fireEvent.click(screen.getByRole('button', { name: 'Start writing' }))
  fireEvent.change(screen.getByLabelText('Your remix'), { target: { value: text } })
  fireEvent.click(screen.getByRole('button', { name: 'Put it on the shelf' }))
}

describe('StyleRemixLab', () => {
  it('draws a style, writes a remix, and shelves it without saving a piece yet', () => {
    const { writer, tick } = renderLab()
    shelveAVersion(tick)
    expect(screen.getByText('Same scene, 1 ways')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Draw another style/ })).toBeTruthy()
    // Shelving isn't finishing: no piece until the revision pass completes.
    expect(writer.created).toEqual([])
  })

  it('requires at least two versions before polishing a favourite', () => {
    const { tick } = renderLab()
    shelveAVersion(tick)
    fireEvent.click(screen.getByRole('button', { name: 'Pick Make It Spooky' }))
    fireEvent.click(screen.getByRole('button', { name: 'Polish my favourite' }))
    expect(screen.getByText('Same scene, 1 ways')).toBeTruthy()
  })

  it('never draws a style twice, and saves every version with the favourite marked', async () => {
    const { writer, tick } = renderLab()
    shelveAVersion(tick)
    fireEvent.click(screen.getByRole('button', { name: /Draw another style/ }))
    shelveAVersion(tick, `${REMIX} On the news tonight.`)
    expect(screen.getByRole('button', { name: 'Pick News Report' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Pick News Report' }))
    expect(screen.getByRole('button', { name: 'Picked News Report' }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: 'Polish my favourite' }))
    tick(COACH_THINKING_MS)
    fireEvent.change(screen.getByLabelText('Your story'), { target: { value: 'Breaking news: a small dog escaped.' } })
    fireEvent.click(screen.getByRole('button', { name: "I'm happy with it" }))

    expect(await screen.findByText(/Illustrating piece-1: Same Scene, Six Ways/)).toBeTruthy()
    expect(writer.remixes.map((r) => [r.style_key, r.is_favourite])).toEqual([
      ['spooky', false],
      ['news', true],
    ])
    expect(writer.created[0]).toMatchObject({ game_id: 'style_remix_lab', body: 'Breaking news: a small dog escaped.' })
  })

  it('calls onBack from the drawing screen', () => {
    const { onBack } = renderLab()
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(onBack).toHaveBeenCalled()
  })
})
