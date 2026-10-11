import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { IllustrationArrival } from './illustration_arrival.pure.ui.tsx'

afterEach(cleanup)

describe('IllustrationArrival', () => {
  it('lists each arriving picture and can replay', () => {
    render(<IllustrationArrival items={[{ kicker: 'Page 2', quote: 'The bus stopped.' }, { kicker: 'Page 3', quote: 'The crow laughed.' }]} />)
    expect(screen.getByRole('img', { name: 'Moment 2' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Replay' }))
    expect(screen.getByText(/The crow laughed/)).toBeTruthy()
  })
})
