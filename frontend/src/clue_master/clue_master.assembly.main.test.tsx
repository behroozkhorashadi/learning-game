import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { assembleClueMaster } from './clue_master.assembly.main.ts'

afterEach(cleanup)

describe('assembleClueMaster', () => {
  it('assembles the real graph and opens on the deal', () => {
    const ClueMaster = assembleClueMaster()
    render(<ClueMaster profileId={1} onBack={vi.fn()} onFinished={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Deal my ending' })).toBeTruthy()
  })
})
