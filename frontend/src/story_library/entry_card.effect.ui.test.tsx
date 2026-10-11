import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { bindStorybookEntryCard } from './entry_card.effect.ui.tsx'
import { LIGHTHOUSE } from './library_fixtures.test.lib.ts'

afterEach(cleanup)

describe('bindStorybookEntryCard', () => {
  it('loads the peek for the profile, then shows it', async () => {
    const asked: number[] = []
    const Card = bindStorybookEntryCard({
      loadPeek: (id) => {
        asked.push(id)
        return Promise.resolve({ pieces: [LIGHTHOUSE], illustrations: {} })
      },
    })
    render(<Card profileId={4} onOpen={vi.fn()} />)
    expect(await screen.findByText('1 story')).toBeTruthy()
    expect(asked).toEqual([4])
  })
})
