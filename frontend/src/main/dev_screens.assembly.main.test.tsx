import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { assembleDevScreens } from './dev_screens.assembly.main.ts'

afterEach(() => {
  cleanup()
  localStorage.clear()
})

describe('assembleDevScreens', () => {
  it('assembles every registered screen into something renderable', () => {
    for (const [id, { assemble }] of Object.entries(assembleDevScreens())) {
      const Screen = assemble()
      const { unmount } = render(<Screen />)
      expect(screen.getByRole('heading').textContent, id).toBeTruthy()
      unmount()
    }
  })
})
