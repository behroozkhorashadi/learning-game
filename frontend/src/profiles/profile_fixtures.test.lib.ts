import type { ProfileRecord } from '@app/api/profiles_schema.pure.lib.ts'

/** Shared test/story fixtures for the profiles feature. */
export const DEMO: ProfileRecord = { id: 1, name: 'Demo Kid', avatar: 'fox', birth_year: 2020, reading_support: false, has_password: false, created_at: null, parent_id: null }
export const RAMI: ProfileRecord = { id: 2, name: 'Rami', avatar: 'rami', birth_year: 2019, reading_support: false, has_password: false, created_at: null, parent_id: null }
export const LOCKED: ProfileRecord = { id: 3, name: 'Nora', avatar: 'owl', birth_year: 2018, reading_support: true, has_password: true, created_at: null, parent_id: null }
export const PROFILES: readonly ProfileRecord[] = [DEMO, RAMI, LOCKED]
