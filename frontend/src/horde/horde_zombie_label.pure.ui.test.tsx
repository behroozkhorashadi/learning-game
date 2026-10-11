import ReactThreeTestRenderer from '@react-three/test-renderer'
import { cleanup, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { HordeZombieLabel } from './horde_zombie_label.pure.ui.tsx'

/** drei's Html portals into a DOM canvas the test renderer doesn't have, so it hands its content to the test. */

const portalled = vi.hoisted((): { content: ReactNode } => ({ content: null }))

vi.mock('@react-three/drei', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@react-three/drei')>()),
  Html: ({ children }: { readonly children: ReactNode }) => {
    portalled.content = children
    return null
  },
}))

afterEach(() => {
  cleanup()
  portalled.content = null
})

describe('HordeZombieLabel', () => {
  it('shows the answer ringed in the slot colour, over a health bar', async () => {
    await ReactThreeTestRenderer.create(<HordeZombieLabel answer="7" color="#144FFF" health={0.5} />)
    const { container } = render(<>{portalled.content}</>)
    expect(screen.getByText('7').style.border).toBe('4px solid rgb(20, 79, 255)')
    expect(container.querySelector('[style*="width: 50%"]')).toBeTruthy()
  })

  it('shows only the health bar between questions', async () => {
    await ReactThreeTestRenderer.create(<HordeZombieLabel answer={null} color="#144FFF" health={1} />)
    const { container } = render(<>{portalled.content}</>)
    expect(container.textContent).toBe('')
    expect(container.querySelector('[style*="width: 100%"]')).toBeTruthy()
  })
})
