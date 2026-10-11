import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { manualTimers } from '@app/timing/manual_timers.test.lib.ts'
import { cardsIn } from './modifier_cards.pure.lib.ts'
import { bindModifierDeck } from './modifier_deck.effect.ui.tsx'

afterEach(cleanup)

describe('ModifierDeck', () => {
  it('draws a card by the random source, lifts and flips it, then hands it over', () => {
    const timers = manualTimers()
    const ModifierDeck = bindModifierDeck({ timers, random: () => 0 })
    const onSelectCard = vi.fn()
    render(<ModifierDeck onSelectCard={onSelectCard} />)
    fireEvent.click(screen.getByRole('button', { name: /Tricky/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Draw a card' }))
    expect(screen.getByRole('button', { name: 'Drawing…' })).toBeTruthy()
    act(() => {
      timers.advance(1080)
    })
    fireEvent.click(screen.getByRole('button', { name: 'Use this card →' }))
    expect(onSelectCard).toHaveBeenCalledWith(cardsIn('tricky')[0])
  })

  it('picks a card from the full deck directly', () => {
    const ModifierDeck = bindModifierDeck({ timers: manualTimers(), random: () => 0 })
    const onSelectCard = vi.fn()
    render(<ModifierDeck onSelectCard={onSelectCard} />)
    const twist = cardsIn('twist')[1]
    if (twist === undefined) throw new Error('need a twist card')
    fireEvent.click(screen.getByRole('button', { name: new RegExp(twist.name) }))
    fireEvent.click(screen.getByRole('button', { name: 'Use this card →' }))
    expect(onSelectCard).toHaveBeenCalledWith(twist)
  })
})
