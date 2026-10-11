import { assembleAdminPanel } from '@app/admin/admin_panel.assembly.main.ts'
import { assembleBadges } from '@app/badges/badges.assembly.main.ts'
import { assembleTodos } from '@app/examples/todo/todo.assembly.main.ts'
import { assembleGamePicker } from '@app/home/game_picker.assembly.main.ts'
import { assembleZombieHorde } from '@app/horde/zombie_horde.assembly.main.ts'
import { assembleOutbreakSettings } from '@app/outbreak/outbreak_settings.assembly.main.ts'
import { assembleZombieMathBlaster } from '@app/outbreak/zombie_math_blaster.assembly.main.ts'
import { assemblePathfinderLevelGallery, assemblePathfinderMapBuilder } from '@app/pathfinder/pathfinder.assembly.main.ts'
import { assembleCreateProfile } from '@app/profiles/create_profile.assembly.main.ts'
import { assembleProfilePicker } from '@app/profiles/profile_picker.assembly.main.ts'
import { assembleSpeech } from '@app/speech/speech.assembly.main.ts'
import { assembleStoryLibrary, assembleStorybookEntryCard } from '@app/story_library/story_library.assembly.main.ts'
import { assembleSyllableBuilder } from '@app/syllable_builder/syllable_builder.assembly.main.ts'
import { assembleIllustrationReveal, assembleModifierDeck } from '@app/writing/writing.assembly.main.ts'
import { WeaponPOCScene } from '@app/zombie_lab/weapon_poc_scene.pure.ui.tsx'
import { assembleZombieHitLab } from '@app/zombie_lab/zombie_hit_lab.assembly.main.ts'
import { ZombiePOCScene } from '@app/zombie_lab/zombie_poc_scene.pure.ui.tsx'
import type { DevScreen } from './dev_screen_picker.pure.ui.tsx'
import { bindDevScreens } from './dev_screens.effect.ui.tsx'

/** Every screen the dev picker can open (`?screen=`), bound to the real backend and browser. Dev builds only: app.assembly.main.ts calls this. */
export function assembleDevScreens(): readonly DevScreen[] {
  return bindDevScreens({
    standalone: [{ id: 'todo-example', label: 'Worked example: todos (add ?flags=examples_todo_backup for backup)', Screen: assembleTodos() }],
    speech: assembleSpeech(),
    log: (event, ...details) => {
      console.log(event, ...details)
    },
    ProfilePicker: assembleProfilePicker(),
    CreateProfile: assembleCreateProfile(),
    AdminPanel: assembleAdminPanel(),
    GamePicker: assembleGamePicker(),
    OutbreakSettings: assembleOutbreakSettings(),
    SyllableBuilder: assembleSyllableBuilder(),
    ZombieMathBlaster: assembleZombieMathBlaster(),
    ZombieHorde: assembleZombieHorde(),
    ZombiePOCScene,
    ZombieHitLab: assembleZombieHitLab(),
    WeaponPOCScene,
    Badges: assembleBadges(),
    StoryLibrary: assembleStoryLibrary(),
    StorybookEntryCard: assembleStorybookEntryCard(),
    PathfinderMapBuilder: assemblePathfinderMapBuilder(),
    PathfinderLevelGallery: assemblePathfinderLevelGallery(),
    IllustrationReveal: assembleIllustrationReveal(),
    ModifierDeck: assembleModifierDeck(),
  })
}
