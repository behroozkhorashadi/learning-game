import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CARDS } from './modifier_cards.pure.lib.ts'
import { ModifierRuleBar } from './modifier_rule_bar.pure.ui.tsx'

afterEach(cleanup)

describe('ModifierRuleBar', () => {
  it('pins the rule, explains it on request, and offers a redraw', () => {
    const card = CARDS[0]
    if (card === undefined) throw new Error('need a card')
    const onRedraw = vi.fn()
    const onKeepWriting = vi.fn()
    render(<ModifierRuleBar card={card} onRedraw={onRedraw} onKeepWriting={onKeepWriting} />)
    expect(screen.getByText(card.name)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'What does this mean?' }))
    expect(screen.getByText(card.meaning)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Draw a different card' }))
    fireEvent.click(screen.getByRole('button', { name: 'Keep writing' }))
    expect([onRedraw.mock.calls.length, onKeepWriting.mock.calls.length]).toEqual([1, 1])
  })
})
