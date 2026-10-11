import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { DenFlipCard } from './den_flip_card.pure.ui.tsx'

afterEach(cleanup)

describe('DenFlipCard', () => {
  it('shows the face: name, meaning, and example', () => {
    render(<DenFlipCard kicker="Prefix" cardName="un-" meaning="not" example="unhappy" exampleLabel="Like" backLabel="Word part" />)
    for (const text of ['Prefix', 'un-', 'not', 'unhappy', 'Like', 'Word part']) expect(screen.getByText(text)).toBeTruthy()
  })

  it('rotates to the back when not flipped', () => {
    const { container } = render(<DenFlipCard flipped={false} cardName="un-" />)
    const rotator = container.querySelector<HTMLElement>('[style*="preserve-3d"]')
    expect(rotator?.style.transform).toBe('rotateY(180deg)')
  })

  it('draws one pip per tier, filled up to the tier', () => {
    const { container } = render(<DenFlipCard tier={2} accent="#ff0000" />)
    const pips = Array.from(container.querySelectorAll<HTMLElement>('div[style*="width: 5px"]'))
    expect(pips.map((p) => p.style.background)).toEqual(['rgb(255, 0, 0)', 'rgb(255, 0, 0)', 'var(--paper-400)'])
  })
})
