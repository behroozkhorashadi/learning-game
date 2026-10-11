import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { assembleTagTeam } from './tag_team.assembly.main.ts'

afterEach(cleanup)

describe('assembleTagTeam', () => {
  it('assembles the real graph and opens on setup', () => {
    const TagTeam = assembleTagTeam()
    render(<TagTeam profileId={1} onBack={vi.fn()} onFinished={vi.fn()} />)
    expect(screen.getByRole('button', { name: "I'll start us off →" })).toBeTruthy()
  })
})
