import type { ProfileAuth, ProfileRecord } from '@app/api/profiles_schema.pure.lib.ts'
import type { ProfileUpdateBody } from './edit_profile_draft.pure.lib.ts'
import type { SavedPhoto } from './profile_photo_state.pure.lib.ts'

/**
 * An in-memory stand-in for the profiles adapter (src/api/profiles_api), for
 * tests and stories of the edit, unlock, and admin screens. Each call is
 * recorded with the auth it carried, so tests can assert who was acting.
 */
export interface FakeProfilesServer {
  readonly profiles: () => readonly ProfileRecord[]
  readonly photos: () => readonly SavedPhoto[]
  readonly calls: readonly { readonly op: string; readonly id: number; readonly auth?: ProfileAuth; readonly body?: ProfileUpdateBody }[]
  readonly list: () => Promise<readonly ProfileRecord[]>
  readonly update: (id: number, body: ProfileUpdateBody, auth: ProfileAuth) => Promise<ProfileRecord>
  readonly remove: (id: number, auth: ProfileAuth) => Promise<void>
  readonly unlock: (id: number, password: string) => Promise<'unlocked' | 'wrong-password'>
  readonly listPhotos: (id: number, auth: ProfileAuth) => Promise<readonly SavedPhoto[]>
  readonly deletePhoto: (id: number, photoId: number, auth: ProfileAuth) => Promise<void>
}

export interface FakeProfilesOptions {
  readonly profiles: readonly ProfileRecord[]
  readonly photos?: readonly SavedPhoto[]
  /** The password every protected profile accepts. */
  readonly password?: string
  /** Makes the named operation reject with this message. */
  readonly fail?: { readonly op: 'update' | 'remove' | 'deletePhoto' | 'list'; readonly message: string }
}

export function fakeProfilesServer({ profiles: initial, photos: initialPhotos = [], password = 'tiger42', fail }: FakeProfilesOptions): FakeProfilesServer {
  let profiles = initial
  let photos = initialPhotos
  const calls: { op: string; id: number; auth?: ProfileAuth; body?: ProfileUpdateBody }[] = []
  const failing = (op: string): Promise<never> | null => (fail?.op === op ? Promise.reject(new Error(fail.message)) : null)

  return {
    profiles: () => profiles,
    photos: () => photos,
    calls,
    list: () => {
      calls.push({ op: 'list', id: 0 })
      return failing('list') ?? Promise.resolve(profiles)
    },
    update: (id, body, auth) => {
      calls.push({ op: 'update', id, auth, body })
      const failed = failing('update')
      if (failed !== null) return failed
      const current = profiles.find((p) => p.id === id)
      if (current === undefined) return Promise.reject(new Error(`no profile ${String(id)}`))
      const updated: ProfileRecord = {
        ...current,
        name: body.name ?? current.name,
        birth_year: body.birth_year ?? current.birth_year,
        reading_support: body.reading_support ?? current.reading_support,
        avatar: body.avatar ?? current.avatar,
        has_password: body.remove_password ? false : body.password != null ? true : current.has_password,
      }
      profiles = profiles.map((p) => (p.id === id ? updated : p))
      return Promise.resolve(updated)
    },
    remove: (id, auth) => {
      calls.push({ op: 'remove', id, auth })
      const failed = failing('remove')
      if (failed !== null) return failed
      profiles = profiles.filter((p) => p.id !== id)
      return Promise.resolve()
    },
    unlock: (id, attempt) => {
      calls.push({ op: 'unlock', id })
      return Promise.resolve(attempt === password ? 'unlocked' : 'wrong-password')
    },
    listPhotos: (id, auth) => {
      calls.push({ op: 'listPhotos', id, auth })
      return Promise.resolve(photos)
    },
    deletePhoto: (id, photoId, auth) => {
      calls.push({ op: 'deletePhoto', id, auth })
      const failed = failing('deletePhoto')
      if (failed !== null) return failed
      photos = photos.filter((p) => p.id !== photoId)
      return Promise.resolve()
    },
  }
}
