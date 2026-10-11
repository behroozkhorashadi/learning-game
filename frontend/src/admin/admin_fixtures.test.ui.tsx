import type { ComponentType } from 'react'
import type { ProfileRecord } from '@app/api/profiles_schema.pure.lib.ts'
import { bindEditProfile } from '@app/profiles/edit_profile.effect.ui.tsx'
import { bindProfilePhotoCapture } from '@app/profiles/profile_photo_capture.effect.ui.tsx'
import { fakeCamera, fakeRemix } from '@app/profiles/profile_photo_fixtures.test.lib.ts'
import { fakeProfilesServer, type FakeProfilesServer } from '@app/profiles/profiles_api_fake.test.lib.ts'
import { bindAdminLogin } from './admin_login.effect.ui.tsx'
import { bindAdminPanel, type AdminPanelProps } from './admin_panel.effect.ui.tsx'

export const ADMIN_PASSWORD = 'parentcode123'

export const PLAYERS: readonly ProfileRecord[] = [
  { id: 1, name: 'Demo Kid', avatar: 'fox', birth_year: 2020, reading_support: false, has_password: false, created_at: null },
  { id: 2, name: 'Rami', avatar: 'rami', birth_year: 2019, reading_support: false, has_password: true, created_at: null },
]

/** The admin panel bound over an in-memory server, the real edit screen, and a fixed clock. */
export function fakeAdminPanel(server: FakeProfilesServer = fakeProfilesServer({ profiles: PLAYERS })): {
  readonly AdminPanel: ComponentType<AdminPanelProps>
  readonly server: FakeProfilesServer
  readonly logins: readonly string[]
} {
  const logins: string[] = []
  const AdminPanel = bindAdminPanel({
    listProfiles: server.list,
    removeProfile: server.remove,
    AdminLogin: bindAdminLogin({
      login: (password) => {
        logins.push(password)
        return Promise.resolve(password === ADMIN_PASSWORD ? 'ok' : 'wrong-password')
      },
    }),
    EditProfile: bindEditProfile({
      updateProfile: server.update,
      listPhotos: server.listPhotos,
      deletePhoto: server.deletePhoto,
      PhotoCapture: bindProfilePhotoCapture({ camera: fakeCamera(), remixPhoto: fakeRemix().remixPhoto }),
      today: () => '2026-10-10',
    }),
    today: () => '2026-10-10',
  })
  return { AdminPanel, server, logins }
}
