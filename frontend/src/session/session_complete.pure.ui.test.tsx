import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SessionComplete } from './session_complete.pure.ui.tsx'

afterEach(cleanup)

describe('SessionComplete', () => {
  it('celebrates the reward and lists what was made', () => {
    render(<SessionComplete headline="Great job!" subtitle="Five words built." badgeSrc="/b.png" badgeTitle="Word Wizard" words={['rab-bit', 'pen-cil']} onPlayAgain={vi.fn()} onAllDone={vi.fn()} />)
    expect(screen.getByRole('img', { name: 'Word Wizard' })).toBeTruthy()
    expect(screen.getByText('Words you built')).toBeTruthy()
    expect(screen.getByText('rab-bit')).toBeTruthy()
  })

  it('uses a custom items label and summary slot', () => {
    render(<SessionComplete headline="" subtitle="" badgeSrc="" badgeTitle="" words={[]} itemsLabel="Equations you solved" summarySlot={<p>3 of 5</p>} onPlayAgain={vi.fn()} onAllDone={vi.fn()} />)
    expect(screen.getByText('Equations you solved')).toBeTruthy()
    expect(screen.getByText('3 of 5')).toBeTruthy()
  })

  it('offers to play again or finish', () => {
    const onPlayAgain = vi.fn()
    const onAllDone = vi.fn()
    render(<SessionComplete headline="" subtitle="" badgeSrc="" badgeTitle="" words={[]} onPlayAgain={onPlayAgain} onAllDone={onAllDone} />)
    fireEvent.click(screen.getByRole('button', { name: 'Play again' }))
    fireEvent.click(screen.getByRole('button', { name: 'All done' }))
    expect([onPlayAgain.mock.calls.length, onAllDone.mock.calls.length]).toEqual([1, 1])
  })
})
