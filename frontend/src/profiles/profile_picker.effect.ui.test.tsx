import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ProfileRecord } from '@app/api/profiles_schema.pure.lib.ts'
import { PROFILES, RAMI } from './profile_fixtures.test.lib.ts'
import { bindProfilePicker } from './profile_picker.effect.ui.tsx'

afterEach(cleanup)

const callbacks = { onSelect: vi.fn(), onAddPlayer: vi.fn(), onEditProfile: vi.fn(), onOpenAdmin: vi.fn() }

/** A list call that settles when the test says, so the loading state is observable. */
function deferredList(): { readonly listProfiles: () => Promise<readonly ProfileRecord[]>; readonly resolve: (p: readonly ProfileRecord[]) => void; readonly reject: (e: Error) => void } {
  let resolve: (p: readonly ProfileRecord[]) => void = () => undefined
  let reject: (e: Error) => void = () => undefined
  const promise = new Promise<readonly ProfileRecord[]>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { listProfiles: () => promise, resolve, reject }
}

describe('bindProfilePicker', () => {
  it('shows the loaded profiles and selects one', async () => {
    const list = deferredList()
    const ProfilePicker = bindProfilePicker({ listProfiles: list.listProfiles })
    const onSelect = vi.fn()
    render(<ProfilePicker {...callbacks} onSelect={onSelect} />)
    expect(screen.queryByRole('button', { name: 'Add a player' })).toBeNull()

    await act(async () => {
      list.resolve(PROFILES)
    })
    fireEvent.click(screen.getByRole('button', { name: 'Play as Rami' }))
    expect(onSelect).toHaveBeenCalledWith(RAMI)
  })

  it('shows the error when listing fails', async () => {
    const list = deferredList()
    const ProfilePicker = bindProfilePicker({ listProfiles: list.listProfiles })
    render(<ProfilePicker {...callbacks} />)
    await act(async () => {
      list.reject(new Error('GET /api/profiles failed with HTTP 503'))
    })
    expect(screen.getByText('Error: GET /api/profiles failed with HTTP 503')).toBeTruthy()
  })

  it('asks for the list once per mount', async () => {
    const listProfiles = vi.fn(() => Promise.resolve(PROFILES))
    const ProfilePicker = bindProfilePicker({ listProfiles })
    render(<ProfilePicker {...callbacks} />)
    expect(await screen.findByText('Demo Kid')).toBeTruthy()
    expect(listProfiles).toHaveBeenCalledTimes(1)
  })
})
