import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { GearPreview } from './gear_preview.pure.ui.tsx'
import type { GearLook } from './horde_looks.pure.lib.ts'

afterEach(cleanup)

const PLAIN: GearLook = { skinId: 'steel_suit', armTint: null, armorColor: '#5CA8E6', blasterTint: null, emblem: null, billboardUrl: null }

function fills(): readonly (string | null)[] {
  return [...screen.getByRole('img', { name: 'Your gear' }).querySelectorAll('rect, circle')].map((shape) => shape.getAttribute('fill'))
}

describe('GearPreview', () => {
  it('paints the arm and the blaster in their colours', () => {
    render(<GearPreview look={{ ...PLAIN, armTint: { color: '#EC407A', amount: 0.6, glow: 0.18 }, blasterTint: { color: '#00FF88', amount: 0.7, glow: 0.12 } }} />)
    expect(fills()).toContain('#EC407A')
    expect(fills()).toContain('#00FF88')
  })

  it('puts the emblem where it is worn', () => {
    const emblem = { imageUrl: '/art/a1.jpg', ringColor: '#FFAA00', onArm: true, onBlaster: false }
    render(<GearPreview look={{ ...PLAIN, emblem }} />)
    const pictures = (): number => screen.getByRole('img', { name: 'Your gear' }).querySelectorAll('image').length
    expect(pictures()).toBe(1)
    cleanup()
    render(<GearPreview look={{ ...PLAIN, emblem: { ...emblem, onBlaster: true } }} />)
    expect(pictures()).toBe(2)
    cleanup()
    render(<GearPreview look={PLAIN} />)
    expect(pictures()).toBe(0)
  })
})
