import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ParentBadge } from './parent_badge.pure.ui.tsx'

afterEach(cleanup)

describe('ParentBadge', () => {
  it("shows the name's initial, capitalized", () => {
    expect(render(<ParentBadge name=" mom" size={40} />).container.textContent).toBe('M')
  })
})
