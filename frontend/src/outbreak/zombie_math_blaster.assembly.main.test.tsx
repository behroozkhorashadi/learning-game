import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { assembleArenaScheduler, assembleZombieMathBlaster } from './zombie_math_blaster.assembly.main.ts'

/** The real graph up to the Start screen (the 3D view needs WebGL; the e2e suite covers it), plus the browser scheduler. */

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  localStorage.clear()
})

describe('assembleZombieMathBlaster', () => {
  it('opens on the Equation Outbreak start screen', () => {
    const ZombieMathBlaster = assembleZombieMathBlaster()
    render(<ZombieMathBlaster profileId={1} onBack={vi.fn()} />)
    expect(screen.getByText('Equation Outbreak')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Start' })).toBeTruthy()
  })
})

describe('assembleArenaScheduler', () => {
  it('runs a timer once after its delay, unless cancelled', () => {
    vi.useFakeTimers()
    const scheduler = assembleArenaScheduler()
    const ran: string[] = []
    scheduler.after(100, () => ran.push('kept'))
    const cancel = scheduler.after(100, () => ran.push('cancelled'))
    cancel()
    vi.advanceTimersByTime(100)
    expect(ran).toEqual(['kept'])
  })

  it('calls the frame callback every frame until stopped', () => {
    vi.useFakeTimers()
    const scheduler = assembleArenaScheduler()
    let frames = 0
    const stop = scheduler.everyFrame(() => {
      frames += 1
    })
    vi.advanceTimersByTime(100)
    stop()
    const seen = frames
    vi.advanceTimersByTime(100)
    expect(seen).toBeGreaterThan(2)
    expect(frames).toBe(seen)
  })
})
