import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LOADING, loaded } from '@app/query/query_state.pure.lib.ts'
import { EntryCardView } from './entry_card.pure.ui.tsx'
import { CROW, LIGHTHOUSE } from './library_fixtures.test.lib.ts'

afterEach(cleanup)

describe('EntryCardView', () => {
  it('renders nothing until the peek has loaded', () => {
    const { container } = render(<EntryCardView state={LOADING} onOpen={vi.fn()} />)
    expect(container.textContent).toBe('')
  })

  it('counts the stories, names the newest, and opens the library', () => {
    const onOpen = vi.fn()
    render(<EntryCardView state={loaded({ pieces: [CROW, LIGHTHOUSE], illustrations: {} })} onOpen={onOpen} />)
    expect(screen.getByText('2 stories')).toBeTruthy()
    expect(screen.getByText('New: The Crow')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /My storybook/ }))
    expect(onOpen).toHaveBeenCalled()
  })

  it('invites a first story when empty', () => {
    render(<EntryCardView state={loaded({ pieces: [], illustrations: {} })} onOpen={vi.fn()} />)
    expect(screen.getByText('Nothing in it yet')).toBeTruthy()
  })
})
