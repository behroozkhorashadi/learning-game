import ReactThreeTestRenderer from '@react-three/test-renderer'
import { cleanup, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AnswerLabel3D } from './answer_label_3d.pure.ui.tsx'

/**
 * The label is real DOM (drei's Html, portalled over the canvas). The test
 * renderer has no DOM canvas to portal into, so Html hands its content to
 * the test, which renders it with Testing Library.
 */

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

describe('AnswerLabel3D', () => {
  it('shows the answer in a bubble ringed with the lane colour', async () => {
    await ReactThreeTestRenderer.create(<AnswerLabel3D label="7" color="#144FFF" />)
    render(<>{portalled.content}</>)
    expect(screen.getByText('7').style.border).toBe('3px solid rgb(20, 79, 255)')
  })

  it('renders nothing once the carrier is defeated', async () => {
    const renderer = await ReactThreeTestRenderer.create(<AnswerLabel3D label="8" color="#144FFF" hidden />)
    expect(renderer.scene.children).toHaveLength(0)
    expect(portalled.content).toBeNull()
  })
})
