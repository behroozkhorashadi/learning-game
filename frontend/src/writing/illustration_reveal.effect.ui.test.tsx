import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { manualTimers } from '@app/timing/manual_timers.test.lib.ts'
import { bindIllustrationReveal } from './illustration_reveal.effect.ui.tsx'
import { HERO_MIN_MS, MOMENT_MIN_MS, PAINTING_LINE_MS } from './use_illustration_reveal.pure.hook.ts'
import { fakeIllustrator } from './writing_fixtures.test.lib.ts'

afterEach(cleanup)

function renderReveal(fail = false) {
  const timers = manualTimers()
  const illustrator = fakeIllustrator(fail)
  const IllustrationReveal = bindIllustrationReveal({ generateIllustration: illustrator.generateIllustration, timers })
  const onReadItBack = vi.fn()
  render(<IllustrationReveal pieceId="p1" pieceTitle="The crow" wordCount={42} heroExcerpt="The crow found a map." moments={['The bus stopped.', 'It laughed.']} onReadItBack={onReadItBack} onWriteSomethingElse={vi.fn()} />)
  const advance = (ms: number) =>
    act(async () => {
      timers.advance(ms)
      await Promise.resolve()
    })
  return { timers, illustrator, onReadItBack, advance }
}

describe('IllustrationReveal', () => {
  it('paints for at least the minimum dwell, cycling lines, then shows the hero', async () => {
    const { illustrator, advance } = renderReveal()
    expect(screen.getByText('Painting your story')).toBeTruthy()
    expect(screen.getByText('reading what you wrote…')).toBeTruthy()
    await advance(PAINTING_LINE_MS)
    expect(screen.getByText('finding the pictures in it…')).toBeTruthy()
    expect(illustrator.requests).toEqual([{ pieceId: 'p1', request: { prompt_excerpt: 'The crow found a map.', order: 0, is_hero: true } }])
    await advance(HERO_MIN_MS)
    expect(await screen.findByText('I drew what you wrote.')).toBeTruthy()
    expect(screen.getByRole('img', { name: 'Hero illustration' }).getAttribute('src')).toBe('/static/illustrations/1.png')
  })

  it('illustrates one more moment, then saves to the storybook', async () => {
    const { illustrator, onReadItBack, advance } = renderReveal()
    await advance(HERO_MIN_MS)
    fireEvent.click(await screen.findByRole('button', { name: 'Illustrate one more moment' }))
    fireEvent.click(screen.getByRole('button', { name: /The bus stopped/ }))
    expect(screen.getByText('Painting that bit too…')).toBeTruthy()
    await advance(MOMENT_MIN_MS)
    expect(await screen.findByText('In your storybook')).toBeTruthy()
    expect(screen.getByText(/2 pictures for this one/)).toBeTruthy()
    expect(illustrator.requests[1]?.request).toEqual({ prompt_excerpt: 'The bus stopped.', order: 1, is_hero: false })
    fireEvent.click(screen.getByRole('button', { name: 'Read it back' }))
    expect(onReadItBack).toHaveBeenCalled()
  })

  it('still reveals, with the style swatch, when generation fails', async () => {
    const { advance } = renderReveal(true)
    await advance(HERO_MIN_MS)
    expect(await screen.findByText('I drew what you wrote.')).toBeTruthy()
    expect(screen.getByRole('img', { name: 'Hero illustration' }).tagName).toBe('DIV')
  })

  it('changes the style and goes back to keep the original', async () => {
    const { advance } = renderReveal()
    await advance(HERO_MIN_MS)
    fireEvent.click(await screen.findByRole('button', { name: 'Change the style' }))
    fireEvent.click(screen.getByRole('button', { name: /Chalk/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Keep mine' }))
    expect(screen.getByRole('button', { name: 'Save to my storybook' })).toBeTruthy()
  })

  it('stops its timers on unmount', () => {
    const { timers } = renderReveal()
    cleanup()
    timers.advance(HERO_MIN_MS * 2)
    expect(timers.pending()).toBe(0)
  })
})
