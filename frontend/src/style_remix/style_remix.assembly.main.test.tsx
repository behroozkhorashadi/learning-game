import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { assembleStyleRemix } from './style_remix.assembly.main.ts'

afterEach(cleanup)

describe('assembleStyleRemix', () => {
  it('assembles the real graph and opens on a drawn style', () => {
    const StyleRemix = assembleStyleRemix()
    render(<StyleRemix profileId={1} onBack={vi.fn()} onFinished={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Draw a style' })).toBeTruthy()
  })
})
