import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { ProfilePhotoCapture, MAX_REMIXES } from './ProfilePhotoCapture'

const ORIGINAL = 'data:image/png;base64,T1JJR0lOQUw='

// jsdom has no camera, no video playback, and no 2D canvas — stub just enough
// for "Open camera" -> "Take photo" to produce ORIGINAL.
beforeEach(() => {
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: vi.fn(() => Promise.resolve({ getTracks: () => [] })) },
  })
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
  vi.spyOn(HTMLVideoElement.prototype, 'videoWidth', 'get').mockReturnValue(640)
  vi.spyOn(HTMLVideoElement.prototype, 'videoHeight', 'get').mockReturnValue(480)
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: vi.fn() } as unknown as CanvasRenderingContext2D)
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(ORIGINAL)
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function Harness({ onChange }: { onChange: (value: string | null) => void }) {
  const [value, setValue] = useState<string | null>(null)
  return (
    <ProfilePhotoCapture
      value={value}
      onChange={(v) => {
        setValue(v)
        onChange(v)
      }}
    />
  )
}

async function capturePhoto() {
  fireEvent.click(screen.getByRole('button', { name: 'Open camera' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Take photo' }))
}

function mockRemix() {
  let n = 0
  global.fetch = vi.fn(() => {
    n += 1
    return Promise.resolve({ ok: true, json: async () => ({ image_data_url: `data:image/jpeg;base64,remix${n}` }) } as Response)
  }) as unknown as typeof fetch
}

describe('ProfilePhotoCapture remix', () => {
  it('needs a look or an idea before it will try a remix', async () => {
    mockRemix()
    render(<Harness onChange={vi.fn()} />)
    await capturePhoto()

    // DenButton drops onClick when disabled rather than setting the attribute.
    fireEvent.click(screen.getByRole('button', { name: /Try it/ }))
    expect(global.fetch).not.toHaveBeenCalled()

    fireEvent.change(screen.getByPlaceholderText(/pirate hat/), { target: { value: 'rainbow hair' } })
    fireEvent.click(screen.getByRole('button', { name: /Try it/ }))
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1))
  })

  it('previews each remix, lets you pick any version, and stops after the try limit', async () => {
    mockRemix()
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    await capturePhoto()
    expect(onChange).toHaveBeenLastCalledWith(ORIGINAL)

    fireEvent.click(screen.getByRole('button', { name: /Wizard/ }))
    fireEvent.change(screen.getByPlaceholderText(/pirate hat/), { target: { value: 'rainbow hair' } })
    fireEvent.click(screen.getByRole('button', { name: /Try it \(3 tries left\)/ }))

    await screen.findByRole('button', { name: 'Use Wizard + rainbow hair' })
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/profile-photos/remix',
      expect.objectContaining({ body: JSON.stringify({ image_data_url: ORIGINAL, style: 'wizard', idea: 'rainbow hair' }) }),
    )
    expect(onChange).toHaveBeenLastCalledWith('data:image/jpeg;base64,remix1')
    expect(screen.getByAltText('Your profile picture preview').getAttribute('src')).toBe('data:image/jpeg;base64,remix1')

    for (let i = 2; i <= MAX_REMIXES; i++) {
      fireEvent.click(screen.getByRole('button', { name: /Try it/ }))
      await waitFor(() => expect(onChange).toHaveBeenLastCalledWith(`data:image/jpeg;base64,remix${i}`))
    }
    fireEvent.click(screen.getByRole('button', { name: 'No tries left' }))
    expect(global.fetch).toHaveBeenCalledTimes(MAX_REMIXES)

    fireEvent.click(screen.getByRole('button', { name: 'Use Original' }))
    expect(onChange).toHaveBeenLastCalledWith(ORIGINAL)
  })

  it('shows the server error when a remix fails and keeps the photo', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({ ok: false, status: 503, json: async () => ({ detail: "AI photo remix isn't available right now" }) } as Response),
    ) as unknown as typeof fetch
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    await capturePhoto()

    fireEvent.click(screen.getByRole('button', { name: /Cartoon/ }))
    fireEvent.click(screen.getByRole('button', { name: /Try it/ }))

    await screen.findByText(/isn't available right now/)
    expect(onChange).toHaveBeenLastCalledWith(ORIGINAL)
  })
})
