import { useState, type ComponentType, type ReactElement } from 'react'
import type { AdminPanelProps } from '@app/admin/admin_panel.effect.ui.tsx'
import type { BadgeCelebrationsProps } from '@app/badges/badge_celebrations.effect.ui.tsx'
import type { BadgesProps } from '@app/badges/badges.effect.ui.tsx'
import type { ClueMasterProps } from '@app/clue_master/clue_master.effect.ui.tsx'
import type { EquationBuilderProps } from '@app/equation_builder/equation_builder.effect.ui.tsx'
import type { GamePickerProps } from '@app/home/game_picker.pure.ui.tsx'
import type { ZombieHordeProps } from '@app/horde/zombie_horde.effect.ui.tsx'
import type { OutbreakSettingsProps } from '@app/outbreak/outbreak_settings.effect.ui.tsx'
import type { ZombieArenaProps } from '@app/outbreak/zombie_arena.effect.ui.tsx'
import type { PathfinderProps } from '@app/pathfinder/pathfinder.effect.ui.tsx'
import type { CreateProfileProps } from '@app/profiles/create_profile.effect.ui.tsx'
import type { EditProfileProps } from '@app/profiles/edit_profile.effect.ui.tsx'
import type { ProfilePickerProps } from '@app/profiles/profile_picker.pure.ui.tsx'
import type { ProfileUnlockProps } from '@app/profiles/profile_unlock.effect.ui.tsx'
import type { PromptForgeProps } from '@app/prompt_forge/prompt_forge.effect.ui.tsx'
import type { StoryLibraryProps } from '@app/story_library/story_library.effect.ui.tsx'
import type { StyleRemixProps } from '@app/style_remix/style_remix.effect.ui.tsx'
import type { SyllableBuilderProps } from '@app/syllable_builder/syllable_builder.effect.ui.tsx'
import type { TagTeamProps } from '@app/tag_team/tag_team.effect.ui.tsx'
import { START, cancelled, created, editFromHome, editFromPicker, go, saved, selectProfile, switchPlayer, unlocked, type AppState } from './app_navigation.pure.lib.ts'

/** Every screen the app routes between, already bound (app.assembly.main.ts). */
export interface AppScreens {
  readonly ProfilePicker: ComponentType<ProfilePickerProps>
  readonly CreateProfile: ComponentType<CreateProfileProps>
  readonly ProfileUnlock: ComponentType<ProfileUnlockProps>
  readonly EditProfile: ComponentType<EditProfileProps>
  readonly AdminPanel: ComponentType<AdminPanelProps>
  readonly GamePicker: ComponentType<GamePickerProps>
  readonly Badges: ComponentType<BadgesProps>
  /** Over every player screen: new-badge fanfare (a toast while in a game). */
  readonly BadgeCelebrations: ComponentType<BadgeCelebrationsProps>
  readonly StoryLibrary: ComponentType<StoryLibraryProps>
  readonly OutbreakSettings: ComponentType<OutbreakSettingsProps>
  readonly ZombieMathBlaster: ComponentType<ZombieArenaProps>
  readonly ZombieHorde: ComponentType<ZombieHordeProps>
  readonly SyllableBuilder: ComponentType<SyllableBuilderProps>
  readonly EquationBuilder: ComponentType<EquationBuilderProps>
  readonly PromptForge: ComponentType<PromptForgeProps>
  readonly StyleRemixLab: ComponentType<StyleRemixProps>
  readonly TagTeamStory: ComponentType<TagTeamProps>
  readonly ClueMaster: ComponentType<ClueMasterProps>
  readonly Pathfinder: ComponentType<PathfinderProps>
}

export interface AppDeps {
  readonly screens: AppScreens
  /** Rendered over every screen (the dev builds' "Dev screens" link), or null. */
  readonly Overlay: ComponentType | null
}

/** The app shell: one navigation state (app_navigation.pure.lib.ts) and the screen it names. */
export function bindApp({ screens: s, Overlay }: AppDeps): ComponentType {
  function App(): ReactElement {
    const [state, setState] = useState<AppState>(START)
    const update = (next: (current: AppState) => AppState): void => {
      setState(next)
    }
    return (
      <>
        <Screen state={state} update={update} />
        {Overlay !== null && <Overlay />}
      </>
    )
  }

  function Screen({ state, update }: { readonly state: AppState; readonly update: (next: (current: AppState) => AppState) => void }): ReactElement {
    const { screen, player } = state
    const back = (): void => {
      update(cancelled)
    }
    switch (screen.kind) {
      case 'admin':
        return <s.AdminPanel onClose={back} />
      case 'create':
        return <s.CreateProfile onCreated={(profile, password) => { update((st) => created(st, profile, password)) }} onCancel={back} />
      case 'unlock':
        return <s.ProfileUnlock profile={screen.profile} onUnlocked={(password) => { update((st) => unlocked(st, password)) }} onCancel={back} />
      case 'edit':
        return (
          <s.EditProfile
            key={screen.profile.id}
            profile={screen.profile}
            auth={screen.password === null ? { kind: 'none' } : { kind: 'profile', password: screen.password }}
            onSaved={(profile, password) => { update((st) => saved(st, profile, password)) }}
            onCancel={back}
          />
        )
      case 'picker':
        return (
          <s.ProfilePicker
            onSelect={(profile) => { update((st) => selectProfile(st, profile)) }}
            onAddPlayer={() => { update((st) => go(st, { kind: 'create' })) }}
            onEditProfile={(profile) => { update((st) => editFromPicker(st, profile)) }}
            onOpenAdmin={() => { update((st) => go(st, { kind: 'admin' })) }}
          />
        )
      case 'home':
      case 'badges':
      case 'library':
      case 'practice-settings':
      case 'game': {
        // Every screen past the picker belongs to a player; without one, start over.
        if (player === null) return <Screen state={START} update={update} />
        return (
          <>
            <PlayerScreen state={{ screen, player }} update={update} />
            <s.BadgeCelebrations key={player.profile.id} profileId={player.profile.id} mode={screen.kind === 'game' ? 'toast' : 'party'} />
          </>
        )
      }
    }
  }

  function PlayerScreen({ state, update }: { readonly state: { readonly screen: AppState['screen']; readonly player: NonNullable<AppState['player']> }; readonly update: (next: (current: AppState) => AppState) => void }): ReactElement {
    const { screen, player } = state
    const { id, name } = player.profile
    const home = (): void => { update((st) => go(st, { kind: 'home' })) }
    const toLibrary = (): void => { update((st) => go(st, { kind: 'library' })) }
    if (screen.kind === 'badges') return <s.Badges key={id} profileId={id} kidName={name} onBack={home} />
    if (screen.kind === 'library') return <s.StoryLibrary key={id} profileId={id} profileName={name} onBack={home} onWriteNew={home} />
    if (screen.kind === 'practice-settings') return <s.OutbreakSettings profileId={id} onBack={home} />
    if (screen.kind !== 'game') {
      return (
        <s.GamePicker
          profile={player.profile}
          onSelectGame={(gameId) => { update((st) => go(st, { kind: 'game', gameId })) }}
          onSwitchProfile={() => { update(switchPlayer) }}
          onEditProfile={() => { update(editFromHome) }}
          onViewBadges={() => { update((st) => go(st, { kind: 'badges' })) }}
          onOpenPracticeSettings={(gameId) => { update((st) => go(st, { kind: 'practice-settings', gameId })) }}
        />
      )
    }
    switch (screen.gameId) {
      case 'prompt_forge':
        return <s.PromptForge profileId={id} onBack={home} onFinished={toLibrary} />
      case 'style_remix_lab':
        return <s.StyleRemixLab profileId={id} onBack={home} onFinished={toLibrary} />
      case 'tag_team_story':
        return <s.TagTeamStory profileId={id} onBack={home} onFinished={toLibrary} />
      case 'clue_master':
        return <s.ClueMaster profileId={id} onBack={home} onFinished={toLibrary} />
      case 'equation_builder':
        return <s.EquationBuilder profileId={id} onBack={home} />
      case 'fact_fluency':
        return <s.ZombieMathBlaster profileId={id} onBack={home} />
      case 'zombie_horde':
        return <s.ZombieHorde profileId={id} onBack={home} />
      case 'pathfinder_no_way_back':
        return <s.Pathfinder profileId={id} profileName={name} onBack={home} />
      default:
        return <s.SyllableBuilder profileId={id} profileName={name} onBack={home} />
    }
  }

  return App
}
