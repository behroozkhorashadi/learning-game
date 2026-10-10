import type { ComponentType, ReactElement } from 'react'
import type { ProfileRecord } from '@app/api/profiles_schema.pure.lib.ts'
import { useQuery } from '@app/query/use_query.pure.hook.ts'
import { ProfilePickerView, type ProfilePickerProps } from './profile_picker.pure.ui.tsx'

export interface ProfilePickerDeps {
  /** Lists every profile. In the app, the profiles API adapter's `list`. */
  readonly listProfiles: () => Promise<readonly ProfileRecord[]>
}

/** The picker screen: loads the profile list through the injected capability and renders the view. */
export function bindProfilePicker({ listProfiles }: ProfilePickerDeps): ComponentType<ProfilePickerProps> {
  function ProfilePicker(props: ProfilePickerProps): ReactElement {
    const state = useQuery(listProfiles)
    return <ProfilePickerView state={state} {...props} />
  }
  return ProfilePicker
}
