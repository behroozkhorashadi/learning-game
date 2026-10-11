import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState, type ReactElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { bindProfilePhotoCapture, type ProfilePhotoCaptureProps } from './profile_photo_capture.effect.ui.tsx'
import { PHOTO, SAVED, fakeCamera, fakeRemix, remixed, type FakeCamera, type FakeRemix } from './profile_photo_fixtures.test.lib.ts'
import { MAX_REMIXES } from './profile_photo_state.pure.lib.ts'

afterEach(cleanup)

interface Setup {
  readonly camera?: FakeCamera
  readonly remix?: FakeRemix
  readonly initial?: string | null
  readonly props?: Partial<Omit<ProfilePhotoCaptureProps, 'value' | 'onChange'>>
}

/** Binds the panel over fakes and renders it under a parent that owns `value`, as the create/edit screens do. */
function renderPanel({ camera = fakeCamera(), remix = fakeRemix(), initial = null, props = {} }: Setup = {}) {
  const PhotoCapture = bindProfilePhotoCapture({ camera, remixPhoto: remix.remixPhoto })
  const onChange = vi.fn<(value: string | null) => void>()
  const onNewPhotosChange = vi.fn<ProfilePhotoCaptureProps['onNewPhotosChange']>()
  function Parent(): ReactElement {
    const [value, setValue] = useState<string | null>(initial)
    return (
      <PhotoCapture
        value={value}
        onChange={(v) => {
          setValue(v)
          onChange(v)
        }}
        onNewPhotosChange={onNewPhotosChange}
        {...props}
      />
    )
  }
  render(<Parent />)
  return { camera, remix, onChange, onNewPhotosChange }
}

async function capturePhoto(): Promise<void> {
  fireEvent.click(screen.getByRole('button', { name: 'Open camera' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Take photo' }))
}

describe('ProfilePhotoCapture camera', () => {
  it('opens the camera, takes a photo, uses it, and turns the camera off', async () => {
    const { camera, onChange, onNewPhotosChange } = renderPanel()
    await capturePhoto()
    expect(onChange).toHaveBeenLastCalledWith(PHOTO)
    expect(onNewPhotosChange).toHaveBeenLastCalledWith([{ src: PHOTO, label: 'Photo' }])
    expect(screen.getByAltText('Your profile picture preview').getAttribute('src')).toBe(PHOTO)
    expect(camera.stops()).toBe(1)
  })

  it.each([
    ['unsupported', 'This browser does not offer camera access. You can still choose an animal avatar.'],
    ['denied', 'Camera access was not available. Check your browser permission, or choose an animal avatar.'],
  ] as const)('explains a camera that is %s and offers no camera buttons', async (reason, message) => {
    renderPanel({ camera: fakeCamera(reason) })
    fireEvent.click(screen.getByRole('button', { name: 'Open camera' }))
    expect(await screen.findByText(message)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Open camera' })).toBeNull()
  })

  it("'Don't use a photo' clears the picture and offers the camera again", async () => {
    const { onChange } = renderPanel()
    await capturePhoto()
    fireEvent.click(screen.getByRole('button', { name: "Don't use a photo" }))
    expect(onChange).toHaveBeenLastCalledWith(null)
    expect(screen.getByRole('button', { name: 'Open camera' })).toBeTruthy()
  })
})

describe('ProfilePhotoCapture remix', () => {
  it('needs a look or an idea before it will try a remix', async () => {
    const { remix } = renderPanel()
    await capturePhoto()

    // DenButton drops onClick when disabled rather than setting the attribute.
    fireEvent.click(screen.getByRole('button', { name: /Try it/ }))
    fireEvent.change(screen.getByPlaceholderText(/pirate hat/), { target: { value: '   ' } })
    fireEvent.click(screen.getByRole('button', { name: /Try it/ }))
    expect(remix.requests).toHaveLength(0)

    fireEvent.change(screen.getByPlaceholderText(/pirate hat/), { target: { value: 'rainbow hair' } })
    fireEvent.keyDown(screen.getByPlaceholderText(/pirate hat/), { key: 'Enter' })
    await waitFor(() => {
      expect(remix.requests).toEqual([{ image_data_url: PHOTO, style: null, idea: 'rainbow hair' }])
    })
  })

  it('previews a remix, labels it by look and idea, and uses it', async () => {
    const { remix, onChange } = renderPanel()
    await capturePhoto()

    fireEvent.click(screen.getByRole('button', { name: /Wizard/ }))
    fireEvent.change(screen.getByPlaceholderText(/pirate hat/), { target: { value: 'rainbow hair' } })
    fireEvent.click(screen.getByRole('button', { name: 'Try it (3 tries left)' }))

    await screen.findByRole('button', { name: 'Use Wizard + rainbow hair' })
    expect(remix.requests[0]).toEqual({ image_data_url: PHOTO, style: 'wizard', idea: 'rainbow hair' })
    expect(onChange).toHaveBeenLastCalledWith(remixed(1))
    expect(screen.getByAltText('Your profile picture preview').getAttribute('src')).toBe(remixed(1))
    expect(screen.getByRole('button', { name: 'Try it (2 tries left)' })).toBeTruthy()
  })

  it('stops after MAX_REMIXES tries and lets you go back to the original', async () => {
    const { remix, onChange } = renderPanel()
    await capturePhoto()
    fireEvent.click(screen.getByRole('button', { name: /Cartoon/ }))
    for (let i = 1; i <= MAX_REMIXES; i++) {
      fireEvent.click(screen.getByRole('button', { name: /Try it/ }))
      await waitFor(() => {
        expect(onChange).toHaveBeenLastCalledWith(remixed(i))
      })
    }
    fireEvent.click(screen.getByRole('button', { name: 'No tries left' }))
    expect(remix.requests).toHaveLength(MAX_REMIXES)

    fireEvent.click(screen.getByRole('button', { name: 'Use Photo' }))
    expect(onChange).toHaveBeenLastCalledWith(PHOTO)
  })

  it('shows the remix error and keeps the photo', async () => {
    const { onChange } = renderPanel({ remix: fakeRemix("AI photo remix isn't available right now") })
    await capturePhoto()
    fireEvent.click(screen.getByRole('button', { name: /Cartoon/ }))
    fireEvent.click(screen.getByRole('button', { name: /Try it/ }))

    expect((await screen.findByRole('alert')).textContent).toBe("AI photo remix isn't available right now")
    expect(onChange).toHaveBeenLastCalledWith(PHOTO)
    expect(screen.getByRole('button', { name: 'Try it (3 tries left)' })).toBeTruthy()
  })
})

describe('ProfilePhotoCapture pictures', () => {
  it('reports every version, keeps them across a retake, and resets the tries for the new photo', async () => {
    const { onNewPhotosChange } = renderPanel()
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
      { src: PHOTO, label: 'Photo' },
      { src: remixed(1), label: 'Cartoon' },
      { src: PHOTO, label: 'Photo' },
    ])
  })

  it('discards an unsaved version but never the one in use', async () => {
    const { onNewPhotosChange } = renderPanel()
    await capturePhoto()
    fireEvent.click(screen.getByRole('button', { name: /Wizard/ }))
    fireEvent.click(screen.getByRole('button', { name: /Try it/ }))
    await screen.findByRole('button', { name: 'Use Wizard' })

    expect(screen.queryByRole('button', { name: 'Delete Wizard' })).toBeNull() // in use
    fireEvent.click(screen.getByRole('button', { name: 'Delete Photo' }))

    expect(onNewPhotosChange).toHaveBeenLastCalledWith([{ src: remixed(1), label: 'Wizard' }])
    expect(screen.queryByRole('button', { name: 'Use Photo' })).toBeNull()
    // Discarding the original also closes its remix panel.
    expect(screen.queryByRole('group', { name: 'Remix looks' })).toBeNull()
  })

  it('switches between saved pictures', () => {
    const [first, second] = SAVED
    if (first === undefined || second === undefined) throw new Error('fixture needs two saved photos')
    const { onChange } = renderPanel({ initial: first.url, props: { savedPhotos: SAVED } })

    fireEvent.click(screen.getByRole('button', { name: 'Use Space explorer' }))

    expect(onChange).toHaveBeenLastCalledWith(second.url)
    expect(screen.getByAltText('Your profile picture preview').getAttribute('src')).toBe(second.url)
  })

  it('cannot delete a saved picture without onDeleteSaved, or the current one on the server', () => {
    const [first] = SAVED
    if (first === undefined) throw new Error('fixture needs a saved photo')
    renderPanel({ initial: null, props: { savedPhotos: SAVED } })
    expect(screen.queryByRole('button', { name: /^Delete / })).toBeNull()
    cleanup()

    renderPanel({ initial: null, props: { savedPhotos: SAVED, onDeleteSaved: () => Promise.resolve(), currentSavedUrl: first.url } })
    expect(screen.queryByRole('button', { name: 'Delete Photo' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Delete Space explorer' })).toBeTruthy()
  })

  it('asks before deleting a saved picture and shows why a delete failed', async () => {
    const [first, second] = SAVED
    if (first === undefined || second === undefined) throw new Error('fixture needs two saved photos')
    const onDeleteSaved = vi.fn(() => Promise.reject(new Error('server said no')))
    renderPanel({ initial: first.url, props: { savedPhotos: SAVED, onDeleteSaved } })

    fireEvent.click(screen.getByRole('button', { name: 'Delete Space explorer' }))
    expect(onDeleteSaved).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Really delete Space explorer?' }))

    expect((await screen.findByRole('alert')).textContent).toBe('server said no')
    expect(onDeleteSaved).toHaveBeenCalledWith(second)
  })
})
