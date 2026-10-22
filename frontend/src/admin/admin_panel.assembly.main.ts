import type { ComponentType } from 'react'
import { bindAdminApi } from '@app/api/admin_api.effect.lib.ts'
import { bindEngagementApi } from '@app/api/engagement_api.effect.lib.ts'
import { bindProfilesApi } from '@app/api/profiles_api.effect.lib.ts'
import { assembleEditProfile } from '@app/profiles/edit_profile.assembly.main.ts'
import { bindAdminLogin } from './admin_login.effect.ui.tsx'
import { bindAdminPanel, type AdminPanelProps } from './admin_panel.effect.ui.tsx'

/** Wires the admin screen to the real API. Called once by the app shell. */
export function assembleAdminPanel(): ComponentType<AdminPanelProps> {
  const http = { fetch: async (url: string, init: Parameters<typeof fetch>[1]) => fetch(url, init), baseUrl: '' }
  const profiles = bindProfilesApi(http)
  const engagement = bindEngagementApi(http)
  return bindAdminPanel({
    listProfiles: profiles.list,
    removeProfile: profiles.remove,
    engagementSummary: engagement.summary,
    AdminLogin: bindAdminLogin({ login: bindAdminApi(http).login }),
    EditProfile: assembleEditProfile(),
    today: () => new Date().toISOString().slice(0, 10),
  })
}
