import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { DenJar } from './den_jar.pure.ui.tsx'

afterEach(cleanup)

describe('DenJar', () => {
  it('shows the count and fills in proportion to the goal', () => {
    render(<DenJar count={30} goal={120} />)
    expect(screen.getByText('30')).toBeTruthy()
    expect(screen.getByText('words so far')).toBeTruthy()
    const jar = screen.getByRole('progressbar', { name: 'Story jar' })
    expect([jar.getAttribute('aria-valuenow'), jar.getAttribute('aria-valuemax')]).toEqual(['30', '120'])
    expect(jar.querySelector('div')?.style.height).toBe('25%')
  })

  it('caps at full and says so', () => {
    render(<DenJar count={500} goal={120} />)
    expect(screen.getByText('jar is full!')).toBeTruthy()
    const jar = screen.getByRole('progressbar', { name: 'Story jar' })
    expect(jar.getAttribute('aria-valuenow')).toBe('120')
    expect(jar.querySelector('div')?.style.height).toBe('100%')
  })

  it('uses a caption it is given', () => {
    render(<DenJar count={1} caption="one word" />)
    expect(screen.getByText('one word')).toBeTruthy()
  })
})
