import type { ComponentType } from 'react'
import { bindParentsApi } from '@app/api/parents_api.effect.lib.ts'
import { bindCreateParent, type CreateParentProps } from './create_parent.effect.ui.tsx'

/** The "I'm a parent" screen over the real API. Called once by the app shell. */
export function assembleCreateParent(): ComponentType<CreateParentProps> {
  const api = bindParentsApi({ fetch: async (url, init) => fetch(url, init), baseUrl: '' })
  return bindCreateParent({ createParent: api.create })
}
