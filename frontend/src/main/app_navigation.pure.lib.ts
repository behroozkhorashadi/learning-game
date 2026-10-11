import type { ProfileRecord } from '@app/api/profiles_schema.pure.lib.ts'

/**
 * Where the app is, as one value. The legacy shell kept ten independent
 * booleans and picked a screen by precedence; this union makes the screens
 * exclusive, and each user action below is one transition.
 */

/** Who is playing, and the password that unlocked them (kept in memory only, so "Edit profile" doesn't ask again). */
export interface Player {
  readonly profile: ProfileRecord
  readonly password: string | null
}

export type Screen =
  | { readonly kind: 'picker' }
  | { readonly kind: 'admin' }
  | { readonly kind: 'create' }
  | { readonly kind: 'unlock'; readonly profile: ProfileRecord; readonly next: 'play' | 'edit' }
  /** `returnTo` is where Save/Cancel lands: the picker's pencil, or the home's. */
  | { readonly kind: 'edit'; readonly profile: ProfileRecord; readonly password: string | null; readonly returnTo: 'picker' | 'home' }
  | { readonly kind: 'home' }
  | { readonly kind: 'badges' }
  | { readonly kind: 'library' }
  | { readonly kind: 'practice-settings'; readonly gameId: string }
  | { readonly kind: 'game'; readonly gameId: string }

export interface AppState {
  readonly player: Player | null
  readonly screen: Screen
}

export const START: AppState = { player: null, screen: { kind: 'picker' } }

const at = (state: AppState, screen: Screen): AppState => ({ ...state, screen })

/** Picking a profile on the picker: a protected one asks for its password first. */
export function selectProfile(state: AppState, profile: ProfileRecord): AppState {
  return profile.has_password ? at(state, { kind: 'unlock', profile, next: 'play' }) : { player: { profile, password: null }, screen: { kind: 'home' } }
}

/** The picker's edit pencil. */
export function editFromPicker(state: AppState, profile: ProfileRecord): AppState {
  return profile.has_password ? at(state, { kind: 'unlock', profile, next: 'edit' }) : at(state, { kind: 'edit', profile, password: null, returnTo: 'picker' })
}

export function unlocked(state: AppState, password: string): AppState {
  if (state.screen.kind !== 'unlock') return state
  const { profile, next } = state.screen
  return next === 'play' ? { player: { profile, password }, screen: { kind: 'home' } } : at(state, { kind: 'edit', profile, password, returnTo: 'picker' })
}

export function created(_state: AppState, profile: ProfileRecord, password: string | null): AppState {
  return { player: { profile, password }, screen: { kind: 'home' } }
}

/** The home's edit pencil: edits the current player with the password they unlocked with. */
export function editFromHome(state: AppState): AppState {
  return state.player === null ? state : at(state, { kind: 'edit', profile: state.player.profile, password: state.player.password, returnTo: 'home' })
}

/**
 * A saved edit. From the home, the player becomes the updated profile, and
 * their remembered password follows a change (`undefined` means unchanged).
 * From the picker nothing is remembered.
 */
export function saved(state: AppState, profile: ProfileRecord, password: string | null | undefined): AppState {
  if (state.screen.kind !== 'edit') return state
  if (state.screen.returnTo === 'picker') return at(state, { kind: 'picker' })
  const previous = state.player?.password ?? null
  return { player: { profile, password: password === undefined ? previous : password }, screen: { kind: 'home' } }
}

/** Back from an edit, an unlock, create, or admin: to wherever that flow started. */
export function cancelled(state: AppState): AppState {
  if (state.screen.kind === 'edit' && state.screen.returnTo === 'home') return at(state, { kind: 'home' })
  return state.player === null ? at(state, { kind: 'picker' }) : at(state, { kind: 'home' })
}

export function switchPlayer(): AppState {
  return START
}

export function go(state: AppState, screen: Screen): AppState {
  return at(state, screen)
}
