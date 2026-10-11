import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { assemblePromptForge } from './prompt_forge.assembly.main.ts'

afterEach(cleanup)

describe('assemblePromptForge', () => {
  it('assembles the real graph and opens on the forge', () => {
    const PromptForge = assemblePromptForge()
    render(<PromptForge profileId={1} onBack={vi.fn()} onFinished={vi.fn()} />)
    expect(screen.getByText('The Forge')).toBeTruthy()
  })
})
