import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createRef } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LOADING, failed, loaded } from '@app/query/query_state.pure.lib.ts'
import { picture } from '@app/profiles/profile_photo_fixtures.test.lib.ts'
import { ArtStudioView, type ArtStudioViewProps } from './art_studio_view.pure.ui.tsx'

afterEach(cleanup)

function props(overrides: Partial<ArtStudioViewProps> = {}): ArtStudioViewProps {
  return {
    balance: 450,
    price: 300,
    camera: { kind: 'idle' },
    videoRef: createRef<HTMLVideoElement>(),
    selfie: null,
    style: 'zombie_slayer',
    idea: '',
    making: false,
    error: null,
    latest: null,
    gallery: loaded([]),
    onOpenCamera: vi.fn(),
    onTakePhoto: vi.fn(),
    onRetake: vi.fn(),
    onStyle: vi.fn(),
    onIdea: vi.fn(),
    onCreate: vi.fn(),
    onBack: vi.fn(),
    ...overrides,
  }
}

describe('ArtStudioView', () => {
  it('shows the balance and price, and the chosen style', () => {
    render(<ArtStudioView {...props()} />)
    expect(screen.getByRole('status', { name: 'Points' }).textContent).toContain('450 points · each piece costs 300')
    expect(screen.getByRole('button', { name: '🧟 Zombie Slayer' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('picks a style and types an idea', () => {
    const onStyle = vi.fn()
    const onIdea = vi.fn()
    render(<ArtStudioView {...props({ onStyle, onIdea })} />)
    fireEvent.click(screen.getByRole('button', { name: '👾 Pixel Hero' }))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'a cape' } })
    expect(onStyle).toHaveBeenCalledWith('pixel_hero')
    expect(onIdea).toHaveBeenCalledWith('a cape')
  })

  it('creates only with a selfie and while not already making one', () => {
    const onCreate = vi.fn()
    render(<ArtStudioView {...props({ onCreate })} />)
    fireEvent.click(screen.getByRole('button', { name: 'Create art · 300 points' }))
    cleanup()
    render(<ArtStudioView {...props({ onCreate, selfie: picture('#000'), making: true })} />)
    fireEvent.click(screen.getByRole('button', { name: 'Making your art…' }))
    expect(onCreate).not.toHaveBeenCalled()
    cleanup()
    render(<ArtStudioView {...props({ onCreate, selfie: picture('#000') })} />)
    fireEvent.click(screen.getByRole('button', { name: 'Create art · 300 points' }))
    expect(onCreate).toHaveBeenCalledTimes(1)
  })

  it('shows the gallery while loading, failed, and filled', () => {
    render(<ArtStudioView {...props({ gallery: LOADING })} />)
    expect(screen.getByText('Opening your gallery…')).toBeTruthy()
    cleanup()
    render(<ArtStudioView {...props({ gallery: failed('offline') })} />)
    expect(screen.getByRole('alert').textContent).toContain('offline')
    cleanup()
    render(<ArtStudioView {...props({ gallery: loaded([{ id: 'a', profile_id: 1, image_url: picture('#f00'), style: 'comic_hero', idea: '', created_at: '' }]) })} />)
    expect(screen.getByRole('img', { name: 'Comic Hero' })).toBeTruthy()
  })
})
