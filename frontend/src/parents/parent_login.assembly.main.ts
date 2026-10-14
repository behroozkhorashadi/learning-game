import type { ComponentType } from 'react'
import { bindParentsApi } from '@app/api/parents_api.effect.lib.ts'
import { bindParentLogin, type ParentLoginProps } from './parent_login.effect.ui.tsx'

/** The parent sign-in over the real API. Called once by the app shell. */
export function assembleParentLogin(): ComponentType<ParentLoginProps> {
  const api = bindParentsApi({ fetch: async (url, init) => fetch(url, init), baseUrl: '' })
  return bindParentLogin({ unlockParent: api.unlock })
}
