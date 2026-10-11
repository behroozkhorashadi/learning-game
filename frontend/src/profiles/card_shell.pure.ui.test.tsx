import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { CardShell } from './card_shell.pure.ui.tsx'

afterEach(cleanup)

describe('CardShell', () => {
  it('renders its children', () => {
    render(
      <CardShell>
        <h1>Players</h1>
      </CardShell>,
    )
    expect(screen.getByRole('heading', { name: 'Players' })).toBeTruthy()
  })
})
