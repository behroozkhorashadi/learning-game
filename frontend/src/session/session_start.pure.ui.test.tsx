import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SessionStart, type SessionStartProps } from './session_start.pure.ui.tsx'

afterEach(cleanup)

function renderStart(): SessionStartProps {
  const props: SessionStartProps = {
    eyebrow: 'Syllable Builder',
    headline: 'Build five words',
    subtitle: 'Slide the sounds together.',
    sessionLength: 5,
    heroSrc: '/missing.png',
    readingInstructions: false, onHearInstructions: vi.fn(),
    onStart: vi.fn(),
    onBack: vi.fn(),
  }
  render(<SessionStart {...props} />)
  return props
}

describe('SessionStart', () => {
  it('introduces the session and its length', () => {
    renderStart()
    expect(screen.getByText('Build five words')).toBeTruthy()
    expect(screen.getByText('0 / 5')).toBeTruthy()
    expect(screen.getByRole('img', { name: '5 words in this set' })).toBeTruthy()
  })

  it('starts, goes back, and reads the instructions aloud on request', () => {
    const props = renderStart()
    fireEvent.click(screen.getByRole('button', { name: 'Start' }))
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    fireEvent.click(screen.getByRole('button', { name: 'Hear how to play' }))
    expect([props.onStart, props.onBack, props.onHearInstructions].map((f) => vi.mocked(f).mock.calls.length)).toEqual([1, 1, 1])
  })

  it('turns the speaker into a stop button while reading', () => {
    const onHearInstructions = vi.fn()
    render(<SessionStart eyebrow="" headline="" subtitle="" sessionLength={1} heroSrc="/x.png" readingInstructions onHearInstructions={onHearInstructions} onStart={vi.fn()} onBack={vi.fn()} />)
    expect(screen.queryByRole('button', { name: 'Hear how to play' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Stop reading' }))
    expect(onHearInstructions).toHaveBeenCalledTimes(1)
  })

  it('falls back to sparkles when the hero art is missing', () => {
    const { container } = render(<SessionStart eyebrow="" headline="" subtitle="" sessionLength={1} heroSrc="/x.png" readingInstructions={false} onHearInstructions={vi.fn()} onStart={vi.fn()} onBack={vi.fn()} />)
    const img = container.querySelector('img')
    if (img === null) throw new Error('expected the hero image')
    fireEvent.error(img)
    expect(container.querySelector('img')).toBeNull()
  })
})
