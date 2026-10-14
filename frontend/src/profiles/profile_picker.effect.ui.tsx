import type { ComponentType, ReactElement } from 'react'
import type { ParentRecord } from '@app/api/parents_schema.pure.lib.ts'
import type { ProfileRecord } from '@app/api/profiles_schema.pure.lib.ts'
import { useQuery } from '@app/query/use_query.pure.hook.ts'
import { ProfilePickerView, type ProfilePickerProps } from './profile_picker.pure.ui.tsx'

export interface ProfilePickerDeps {
  /** Lists every profile. In the app, the profiles API adapter's `list`. */
  readonly listProfiles: () => Promise<readonly ProfileRecord[]>
  /** Lists the parent accounts (the grown-ups row). */
  readonly listParents: () => Promise<readonly ParentRecord[]>
}

/** The picker screen: loads the profile and parent lists through the injected capability and renders the view. */
export function bindProfilePicker({ listProfiles, listParents }: ProfilePickerDeps): ComponentType<ProfilePickerProps> {
  function ProfilePicker(props: ProfilePickerProps): ReactElement {
    const state = useQuery(listProfiles)
    const parents = useQuery(listParents)
    return <ProfilePickerView state={state} parents={parents} {...props} />
  }
  return ProfilePicker
}
