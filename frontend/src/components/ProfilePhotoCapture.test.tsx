import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { ProfilePhotoCapture, MAX_REMIXES, type NewPhoto } from './ProfilePhotoCapture'
import type { ProfilePhotoRead } from '../types/generated'

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

function Harness({
  onChange,
  onNewPhotosChange = () => {},
  initial = null,
  savedPhotos,
  onDeleteSaved,
}: {
  onChange: (value: string | null) => void
  onNewPhotosChange?: (photos: NewPhoto[]) => void
  initial?: string | null
  savedPhotos?: ProfilePhotoRead[]
  onDeleteSaved?: (photo: ProfilePhotoRead) => Promise<void>
}) {
  const [value, setValue] = useState<string | null>(initial)
  return (
    <ProfilePhotoCapture
      value={value}
      onChange={(v) => {
        setValue(v)
        onChange(v)
      }}
      onNewPhotosChange={onNewPhotosChange}
      savedPhotos={savedPhotos}
      onDeleteSaved={onDeleteSaved}
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

    fireEvent.click(screen.getByRole('button', { name: 'Use Photo' }))
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

describe('ProfilePhotoCapture saved pictures', () => {
  it('reports every version, keeps them across a retake, and resets the tries for the new photo', async () => {
    mockRemix()
    const onNewPhotosChange = vi.fn()
    render(<Harness onChange={vi.fn()} onNewPhotosChange={onNewPhotosChange} />)
    await capturePhoto()
    fireEvent.click(screen.getByRole('button', { name: /Cartoon/ }))
    fireEvent.click(screen.getByRole('button', { name: /Try it/ }))
    await screen.findByRole('button', { name: 'Use Cartoon' })
    expect(screen.getByRole('button', { name: /2 tries left/ })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Take a new photo' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Take photo' }))

    expect(screen.getAllByRole('button', { name: /^Use / })).toHaveLength(3)
    expect(screen.getByRole('button', { name: /3 tries left/ })).toBeTruthy()
    expect(onNewPhotosChange).toHaveBeenLastCalledWith([
      { src: ORIGINAL, label: 'Photo' },
      { src: 'data:image/jpeg;base64,remix1', label: 'Cartoon' },
      { src: ORIGINAL, label: 'Photo' },
    ])
  })

  it('discards an unsaved version but never the one in use', async () => {
    mockRemix()
    const onNewPhotosChange = vi.fn()
    render(<Harness onChange={vi.fn()} onNewPhotosChange={onNewPhotosChange} />)
    await capturePhoto()
    fireEvent.click(screen.getByRole('button', { name: /Wizard/ }))
    fireEvent.click(screen.getByRole('button', { name: /Try it/ }))
    await screen.findByRole('button', { name: 'Use Wizard' })

    expect(screen.queryByRole('button', { name: 'Delete Wizard' })).toBeNull() // in use
    fireEvent.click(screen.getByRole('button', { name: 'Delete Photo' }))

    expect(onNewPhotosChange).toHaveBeenLastCalledWith([{ src: 'data:image/jpeg;base64,remix1', label: 'Wizard' }])
    expect(screen.queryByRole('button', { name: 'Use Photo' })).toBeNull()
  })

  const SAVED: ProfilePhotoRead[] = [
    { id: 1, url: '/static/profile-avatars/a.jpg', label: 'Photo', created_at: '2026-10-01T00:00:00' },
    { id: 2, url: '/static/profile-avatars/b.jpg', label: 'Space explorer', created_at: '2026-10-01T00:00:00' },
  ]

  it('switches between saved pictures', () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} initial={SAVED[0].url} savedPhotos={SAVED} />)

    fireEvent.click(screen.getByRole('button', { name: 'Use Space explorer' }))

    expect(onChange).toHaveBeenLastCalledWith(SAVED[1].url)
    expect(screen.getByAltText('Your profile picture preview').getAttribute('src')).toBe(SAVED[1].url)
  })

  it('asks before deleting a saved picture and shows why a delete failed', async () => {
    const onDeleteSaved = vi.fn(() => Promise.reject(new Error('server said no')))
    render(<Harness onChange={vi.fn()} initial={SAVED[0].url} savedPhotos={SAVED} onDeleteSaved={onDeleteSaved} />)

    fireEvent.click(screen.getByRole('button', { name: 'Delete Space explorer' }))
    expect(onDeleteSaved).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Really delete Space explorer?' }))

    await screen.findByText('server said no')
    expect(onDeleteSaved).toHaveBeenCalledWith(SAVED[1])
  })
})
