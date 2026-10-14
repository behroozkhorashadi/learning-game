import { describe, expect, it } from 'vitest'
import type { ProfileRecord } from '@app/api/profiles_schema.pure.lib.ts'
import { START, cancelled, created, editFromHome, editFromPicker, go, saved, selectProfile, switchPlayer, unlocked } from './app_navigation.pure.lib.ts'

const OPEN: ProfileRecord = { id: 1, name: 'Mia', avatar: 'fox', birth_year: 2019, reading_support: false, has_password: false, created_at: null, parent_id: null }
const LOCKED: ProfileRecord = { ...OPEN, id: 2, name: 'Nora', has_password: true }

describe('app navigation', () => {
  it('an open profile goes straight home; a protected one unlocks first, remembering the password', () => {
    expect(selectProfile(START, OPEN)).toEqual({ player: { profile: OPEN, password: null }, screen: { kind: 'home' } })
    const asking = selectProfile(START, LOCKED)
    expect(asking.screen).toEqual({ kind: 'unlock', profile: LOCKED, next: 'play' })
    expect(unlocked(asking, 'tiger42')).toEqual({ player: { profile: LOCKED, password: 'tiger42' }, screen: { kind: 'home' } })
  })

  it("the picker's pencil edits (after unlocking a protected profile) and returns to the picker", () => {
    expect(editFromPicker(START, OPEN).screen).toEqual({ kind: 'edit', profile: OPEN, password: null, returnTo: 'picker' })
    const editing = unlocked(editFromPicker(START, LOCKED), 'tiger42')
    expect(editing.screen).toEqual({ kind: 'edit', profile: LOCKED, password: 'tiger42', returnTo: 'picker' })
    expect(saved(editing, { ...LOCKED, name: 'N' }, undefined)).toEqual({ player: null, screen: { kind: 'picker' } })
    expect(cancelled(editing).screen).toEqual({ kind: 'picker' })
  })

  it("the home's pencil edits the player and keeps the updated profile and password", () => {
    const home = unlocked(selectProfile(START, LOCKED), 'tiger42')
    const editing = editFromHome(home)
    expect(editing.screen).toEqual({ kind: 'edit', profile: LOCKED, password: 'tiger42', returnTo: 'home' })
    const renamed = { ...LOCKED, name: 'Nora B' }
    expect(saved(editing, renamed, undefined)).toEqual({ player: { profile: renamed, password: 'tiger42' }, screen: { kind: 'home' } })
    expect(saved(editing, renamed, 'lion99').player?.password).toBe('lion99')
    expect(saved(editing, renamed, null).player?.password).toBeNull()
    expect(cancelled(editing)).toEqual(home)
  })

  it('creating a player plays as them; switching forgets them', () => {
    const home = created(START, OPEN, 'pw')
    expect(home).toEqual({ player: { profile: OPEN, password: 'pw' }, screen: { kind: 'home' } })
    expect(switchPlayer()).toEqual(START)
  })

  it('cancel from a side screen returns home when playing, else the picker', () => {
    expect(cancelled(go(START, { kind: 'admin' })).screen).toEqual({ kind: 'picker' })
    expect(cancelled(go(created(START, OPEN, null), { kind: 'badges' })).screen).toEqual({ kind: 'home' })
  })

  it('ignores transitions that do not apply to the current screen', () => {
    expect(unlocked(START, 'x')).toBe(START)
    expect(saved(START, OPEN, undefined)).toBe(START)
    expect(editFromHome(START)).toBe(START)
  })
})
