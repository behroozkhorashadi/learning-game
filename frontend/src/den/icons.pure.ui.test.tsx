import { cleanup, render } from '@testing-library/react'
import type { ComponentType } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import * as icons from './icons.pure.ui.tsx'

afterEach(cleanup)

const ICONS: readonly [string, ComponentType<{ readonly size?: number }>][] = Object.entries(icons)

describe('icons', () => {
  it.each(ICONS)('%s renders an svg at the requested size, colored by currentColor', (_name, Icon) => {
    const { container } = render(<Icon size={40} />)
    const svg = container.querySelector('svg')
    expect(svg?.getAttribute('width')).toBe('40')
    expect(svg?.getAttribute('height')).toBe('40')
    expect(container.innerHTML).toContain('currentColor')
  })
})
