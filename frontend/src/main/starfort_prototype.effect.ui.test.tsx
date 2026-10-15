import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { bindStarfortPrototype } from './starfort_prototype.effect.ui.tsx'

describe('bindStarfortPrototype', () => {
  it('embeds the injected prototype URL in an accessible screen', () => {
    const StarfortPrototype = bindStarfortPrototype({ src: '/starfort.html' })

    render(<StarfortPrototype />)

    expect(screen.getByRole('main', { name: 'Starfort tower defense prototype' })).toBeTruthy()
    expect(screen.getByTitle('Starfort tower defense prototype').getAttribute('src')).toBe('/starfort.html')
  })
})
