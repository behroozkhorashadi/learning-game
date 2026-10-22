import { createElement, type ComponentType } from 'react'
import { assembleAdminPanel } from '@app/admin/admin_panel.assembly.main.ts'
import { assembleBadgeCelebrations } from '@app/badges/badge_celebrations.assembly.main.ts'
import { assembleBadges } from '@app/badges/badges.assembly.main.ts'
import { assembleClueMaster } from '@app/clue_master/clue_master.assembly.main.ts'
import { assembleEquationBuilder } from '@app/equation_builder/equation_builder.assembly.main.ts'
import { bindEngagementApi } from '@app/api/engagement_api.effect.lib.ts'
import { bindEngagementTracker } from '@app/engagement/engagement_tracker.effect.lib.ts'
import { assembleGamePicker } from '@app/home/game_picker.assembly.main.ts'
import { assembleZombieHorde } from '@app/horde/zombie_horde.assembly.main.ts'
import { assembleOutbreakSettings } from '@app/outbreak/outbreak_settings.assembly.main.ts'
import { assembleZombieMathBlaster } from '@app/outbreak/zombie_math_blaster.assembly.main.ts'
import { assembleCreateParent } from '@app/parents/create_parent.assembly.main.ts'
import { assembleParentDashboard } from '@app/parents/parent_dashboard.assembly.main.ts'
import { assembleParentLogin } from '@app/parents/parent_login.assembly.main.ts'
import { assemblePathfinder } from '@app/pathfinder/pathfinder.assembly.main.ts'
import { assembleCreateProfile } from '@app/profiles/create_profile.assembly.main.ts'
import { assembleEditProfile } from '@app/profiles/edit_profile.assembly.main.ts'
import { assembleProfilePicker } from '@app/profiles/profile_picker.assembly.main.ts'
import { assembleProfileUnlock } from '@app/profiles/profile_unlock.assembly.main.ts'
import { assemblePromptForge } from '@app/prompt_forge/prompt_forge.assembly.main.ts'
import { assembleStoryLibrary } from '@app/story_library/story_library.assembly.main.ts'
import { assembleStyleRemix } from '@app/style_remix/style_remix.assembly.main.ts'
import { assembleSyllableBuilder } from '@app/syllable_builder/syllable_builder.assembly.main.ts'
import { assembleTagTeam } from '@app/tag_team/tag_team.assembly.main.ts'
import { bindApp, type AppScreens } from './app.effect.ui.tsx'
import { DevScreenLink, DevScreenPicker } from './dev_screen_picker.pure.ui.tsx'
import { assembleDevScreens } from './dev_screens.assembly.main.ts'

/** Every screen of the real app, bound to the backend and browser. */
export function assembleAppScreens(): AppScreens {
  return {
    ProfilePicker: assembleProfilePicker(),
    CreateProfile: assembleCreateProfile(),
    ProfileUnlock: assembleProfileUnlock(),
    EditProfile: assembleEditProfile(),
    AdminPanel: assembleAdminPanel(),
    CreateParent: assembleCreateParent(),
    ParentLogin: assembleParentLogin(),
    ParentDashboard: assembleParentDashboard(),
    GamePicker: assembleGamePicker(),
    Badges: assembleBadges(),
    BadgeCelebrations: assembleBadgeCelebrations(),
    StoryLibrary: assembleStoryLibrary(),
    OutbreakSettings: assembleOutbreakSettings(),
    ZombieMathBlaster: assembleZombieMathBlaster(),
    ZombieHorde: assembleZombieHorde(),
    SyllableBuilder: assembleSyllableBuilder(),
    EquationBuilder: assembleEquationBuilder(),
    PromptForge: assemblePromptForge(),
    StyleRemixLab: assembleStyleRemix(),
    TagTeamStory: assembleTagTeam(),
    ClueMaster: assembleClueMaster(),
    Pathfinder: assemblePathfinder(),
  }
}

/**
 * The root component. Dev builds with `?screen=` get the dev picker instead
 * of the app (decided once, at startup); dev builds also show the
 * "Dev screens" link over the app.
 */
export function assembleRoot(): ComponentType {
  const dev = import.meta.env.DEV
  const screen = dev ? new URLSearchParams(window.location.search).get('screen') : null
  if (screen !== null) {
    const screens = assembleDevScreens()
    return () => createElement(DevScreenPicker, { screens, screen })
  }
  const engagementApi = bindEngagementApi({ fetch: async (url, init) => fetch(url, init), baseUrl: '' })
  const activityEvents = ['keydown', 'pointerdown', 'pointermove', 'scroll', 'touchstart'] as const
  const engagement = bindEngagementTracker({
    now: () => performance.now(),
    isVisible: () => document.visibilityState === 'visible',
    currentLocation: () => {
      const areas = document.querySelectorAll<HTMLElement>('[data-engagement-area]')
      if (areas.length === 0) return null
      const current = areas.item(areas.length - 1)
      const profile = current.dataset.engagementProfile
      return { area: current.dataset.engagementArea ?? '', profileId: profile === undefined ? null : Number(profile) }
    },
    subscribeActivity: (onActivity) => {
      for (const event of activityEvents) document.addEventListener(event, onActivity, { passive: true })
      return () => {
        for (const event of activityEvents) document.removeEventListener(event, onActivity)
      }
    },
    every: (ms, run) => {
      const id = window.setInterval(run, ms)
      return () => window.clearInterval(id)
    },
    record: engagementApi.record,
  })
  return bindApp({ screens: assembleAppScreens(), engagement, Overlay: dev ? DevScreenLink : null })
}
