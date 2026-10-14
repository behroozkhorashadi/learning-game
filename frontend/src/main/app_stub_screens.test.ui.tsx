import type { ComponentType, ReactElement } from 'react'
import type { ProfileRecord } from '@app/api/profiles_schema.pure.lib.ts'
import type { AppScreens } from './app.effect.ui.tsx'

export const MIA: ProfileRecord = { id: 1, name: 'Mia', avatar: 'fox', birth_year: 2019, reading_support: false, has_password: false, created_at: null }
export const NORA: ProfileRecord = { id: 2, name: 'Nora', avatar: 'owl', birth_year: 2018, reading_support: false, has_password: true, created_at: null }

/**
 * Stand-ins for every screen, for testing the router alone: each shows its
 * name and the props it got, and turns each callback into a button named
 * after it (so a test can "press onBack").
 */
function stub(name: string): ComponentType<object> {
  function Stub(props: object): ReactElement {
    const entries = Object.entries(props)
    return (
      <section aria-label={name}>
        <h1>{name}</h1>
        {entries
          .filter(([, v]) => typeof v !== 'function')
          .map(([k, v]) => (
            <p key={k}>
              {k}: {JSON.stringify(v)}
            </p>
          ))}
        {entries.map(([k, v]) =>
          typeof v === 'function' ? (
            // A prop of unknown type that is a function: called with this callback's canned arguments.
            <button key={k} type="button" onClick={() => (v as (...args: readonly unknown[]) => void)(...(STUB_ARGS[k] ?? []))}>
              {k}
            </button>
          ) : null,
        )}
      </section>
    )
  }
  return Stub
}

/** What each stub callback is called with when its button is pressed. */
const STUB_ARGS: Readonly<Record<string, readonly unknown[]>> = {
  onSelect: [MIA],
  onEditProfile: [NORA],
  onCreated: [MIA, 'pw'],
  onUnlocked: ['tiger42'],
  onSaved: [{ ...NORA, name: 'Nora B' }, undefined],
  onSelectGame: ['prompt_forge'],
  onOpenPracticeSettings: ['fact_fluency'],
}

// Each stub accepts any props; the router type-checks against the real AppScreens.
// A cast is the only way to make one generic stub stand in for each typed screen.
const any = (name: string): never => stub(name) as never

export const STUB_SCREENS: AppScreens = {
  ProfilePicker: any('ProfilePicker'),
  CreateProfile: any('CreateProfile'),
  ProfileUnlock: any('ProfileUnlock'),
  EditProfile: any('EditProfile'),
  AdminPanel: any('AdminPanel'),
  GamePicker: any('GamePicker'),
  Badges: any('Badges'),
  BadgeCelebrations: any('BadgeCelebrations'),
  StoryLibrary: any('StoryLibrary'),
  OutbreakSettings: any('OutbreakSettings'),
  ZombieMathBlaster: any('ZombieMathBlaster'),
  ZombieHorde: any('ZombieHorde'),
  SyllableBuilder: any('SyllableBuilder'),
  EquationBuilder: any('EquationBuilder'),
  PromptForge: any('PromptForge'),
  StyleRemixLab: any('StyleRemixLab'),
  TagTeamStory: any('TagTeamStory'),
  ClueMaster: any('ClueMaster'),
  Pathfinder: any('Pathfinder'),
}
