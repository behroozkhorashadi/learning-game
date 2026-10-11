import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { assembleProfilePhotoCapture } from './profile_photo_capture.assembly.main.ts'

/** The real graph: assembled panel → real camera adapter over a browser with no camera (jsdom). */

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('assembleProfilePhotoCapture', () => {
  it('reports an unsupported camera where the browser offers no media devices', async () => {
    const PhotoCapture = assembleProfilePhotoCapture()
    render(<PhotoCapture value={null} onChange={vi.fn()} onNewPhotosChange={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Open camera' }))
    expect(await screen.findByText(/This browser does not offer camera access/)).toBeTruthy()
  })
})
