import { useState, type ComponentType, type ReactElement, type ReactNode } from 'react'
import type { AdminPanelProps } from '@app/admin/admin_panel.effect.ui.tsx'
import type { BadgesProps } from '@app/badges/badges.effect.ui.tsx'
import type { GamePickerProps } from '@app/home/game_picker.pure.ui.tsx'
import type { OutbreakSettingsProps } from '@app/outbreak/outbreak_settings.effect.ui.tsx'
import type { ZombieArenaProps } from '@app/outbreak/zombie_arena.effect.ui.tsx'
import type { PathfinderMapBuilderProps } from '@app/pathfinder/pathfinder_map_builder.effect.ui.tsx'
import type { CreateProfileProps } from '@app/profiles/create_profile.effect.ui.tsx'
import type { ProfilePickerProps } from '@app/profiles/profile_picker.pure.ui.tsx'
import { HandoffPencil } from '@app/session/handoff_pencil.pure.ui.tsx'
import { ParentVerify } from '@app/session/parent_verify.pure.ui.tsx'
import { ProgressBar } from '@app/session/progress_bar.pure.ui.tsx'
import { RatingPrompt } from '@app/session/rating_prompt.pure.ui.tsx'
import { SessionComplete } from '@app/session/session_complete.pure.ui.tsx'
import { SessionStart } from '@app/session/session_start.pure.ui.tsx'
import type { Speech } from '@app/speech/speech_state.pure.lib.ts'
import type { StorybookEntryCardProps } from '@app/story_library/entry_card.effect.ui.tsx'
import type { StoryLibraryProps } from '@app/story_library/story_library.effect.ui.tsx'
import type { SyllableBuilderProps } from '@app/syllable_builder/syllable_builder.effect.ui.tsx'
import { TileBoard } from '@app/tiles/tile_board.pure.ui.tsx'
import { CoachPanel } from '@app/writing/coach_panel.pure.ui.tsx'
import { IllustrationArrival } from '@app/writing/illustration_arrival.pure.ui.tsx'
import type { IllustrationRevealProps } from '@app/writing/illustration_reveal.effect.ui.tsx'
import type { ModifierDeckProps } from '@app/writing/modifier_deck.effect.ui.tsx'
import { ModifierRuleBar } from '@app/writing/modifier_rule_bar.pure.ui.tsx'
import { WritingSurface } from '@app/writing/writing_surface.pure.ui.tsx'
import { MOCK_ARRIVAL, MOCK_DRAFT, MOCK_MODIFIER_CARD, MOCK_MOMENTS, MOCK_PROFILE, MOCK_QUESTIONS, TILE_ITEM } from './dev_fixtures.pure.lib.ts'
import type { DevScreen } from './dev_screen_picker.pure.ui.tsx'

/** The bound screens the dev picker can open, from dev_screens.assembly.main.ts. */
export interface DevScreensDeps {
  /** New-style screens with no props, by id (e.g. the worked example). */
  readonly standalone: readonly DevScreen[]
  readonly speech: Speech
  readonly log: (event: string, ...details: readonly unknown[]) => void
  readonly ProfilePicker: ComponentType<ProfilePickerProps>
  readonly CreateProfile: ComponentType<CreateProfileProps>
  readonly AdminPanel: ComponentType<AdminPanelProps>
  readonly GamePicker: ComponentType<GamePickerProps>
  readonly OutbreakSettings: ComponentType<OutbreakSettingsProps>
  readonly SyllableBuilder: ComponentType<SyllableBuilderProps>
  readonly ZombieMathBlaster: ComponentType<ZombieArenaProps>
  readonly ZombiePOCScene: ComponentType
  readonly ZombieHitLab: ComponentType
  readonly WeaponPOCScene: ComponentType
  readonly Badges: ComponentType<BadgesProps>
  readonly StoryLibrary: ComponentType<StoryLibraryProps>
  readonly StorybookEntryCard: ComponentType<StorybookEntryCardProps>
  readonly PathfinderMapBuilder: ComponentType<PathfinderMapBuilderProps>
  readonly PathfinderLevelGallery: ComponentType
  readonly IllustrationReveal: ComponentType<IllustrationRevealProps>
  readonly ModifierDeck: ComponentType<ModifierDeckProps>
}

function CardWrapper({ children, wide = false }: { readonly children: ReactNode; readonly wide?: boolean }): ReactElement {
  return (
    <div style={{ minHeight: '100%', boxSizing: 'border-box', background: 'var(--surface-app)', display: 'flex', justifyContent: 'center', padding: '32px 24px 56px' }}>
      <div style={{ width: '100%', maxWidth: wide ? 1180 : 760, display: 'flex', flexDirection: 'column', gap: 24 }}>{children}</div>
    </div>
  )
}

/** Every dev screen, in list order: each a zero-prop component over mock props and the bound screens. */
export function bindDevScreens(d: DevScreensDeps): readonly DevScreen[] {
  const { log, speech } = d
  const back = (): void => {
    log('onBack')
  }
  const instructions = "Slide the sounds together to make five words. Take your time — there's no clock."

  function WritingSurfaceDemo(): ReactElement {
    const [value, setValue] = useState(MOCK_DRAFT)
    return (
      <CardWrapper wide>
        <WritingSurface
          briefTitle="Write a story about someone who keeps a promise nobody is watching them keep."
          briefBody="You have three ingredients to work in. Use them however you like — you don't have to use them in order."
          briefChips={['a lighthouse', 'eleven years', 'one jar of oil']}
          value={value}
          onChange={setValue}
          wordGoal={40}
          onPolish={() => { log('onPolish') }}
          onKeepWriting={() => { log('onKeepWriting') }}
        />
      </CardWrapper>
    )
  }

  function CoachPanelDemo(): ReactElement {
    const [value, setValue] = useState(MOCK_DRAFT)
    return (
      <CardWrapper wide>
        <CoachPanel pieceTitle="The Ninety-Six Steps" value={value} onChange={setValue} status="questions" questions={MOCK_QUESTIONS} onHappy={() => { log('onHappy') }} />
      </CardWrapper>
    )
  }

  const screen = (id: string, label: string, Screen: ComponentType): DevScreen => ({ id, label, Screen })

  return [
    ...d.standalone,
    screen('profile-picker', 'Profile picker', () => (
      <d.ProfilePicker onSelect={(p) => { log('onSelect', p) }} onAddPlayer={() => { log('onAddPlayer') }} onEditProfile={(p) => { log('onEditProfile', p) }} onOpenAdmin={() => { log('onOpenAdmin') }} />
    )),
    screen('create-profile', 'Create profile', () => <d.CreateProfile onCreated={(p) => { log('onCreated', p) }} onCancel={() => { log('onCancel') }} />),
    screen('admin-panel', 'Admin panel', () => <d.AdminPanel onClose={() => { log('onClose') }} />),
    screen('game-picker', 'Game picker', () => (
      <d.GamePicker
        profile={MOCK_PROFILE}
        onSelectGame={(id) => { log('onSelectGame', id) }}
        onSwitchProfile={() => { log('onSwitchProfile') }}
        onEditProfile={() => { log('onEditProfile') }}
        onViewBadges={() => { log('onViewBadges') }}
        onOpenPracticeSettings={(id) => { log('onOpenPracticeSettings', id) }}
      />
    )),
    screen('equation-outbreak-settings', 'Equation Outbreak settings (live — hits the backend)', () => <d.OutbreakSettings profileId={MOCK_PROFILE.id} onBack={back} />),
    screen('syllable-builder', 'Syllable Builder (live — hits the backend)', () => <d.SyllableBuilder profileId={MOCK_PROFILE.id} profileName={MOCK_PROFILE.name} onBack={back} />),
    screen('zombie-3d-poc', 'Equation Outbreak 3D character POC', d.ZombiePOCScene),
    screen('zombie-hit-lab', 'Equation Outbreak hit lab (label shots, score hitboxes)', d.ZombieHitLab),
    screen('weapon-3d-poc', 'Equation Outbreak weapon-assembly POC', d.WeaponPOCScene),
    screen('equation-outbreak-live', 'Equation Outbreak (live — hits the backend)', () => <d.ZombieMathBlaster profileId={MOCK_PROFILE.id} onBack={back} />),
    screen('badges', 'Badges & Accomplishments', () => <d.Badges profileId={MOCK_PROFILE.id} kidName={MOCK_PROFILE.name} onBack={back} />),
    screen('session-start', 'Session start', () => (
      <CardWrapper>
        <SessionStart
          eyebrow="Word building"
          headline="Let's build some words"
          subtitle={instructions}
          onHearInstructions={() => { speech.speakText(instructions) }}
          sessionLength={5}
          heroSrc="/images/badges/syllable_builder.png"
          onStart={() => { log('onStart') }}
          onBack={back}
        />
      </CardWrapper>
    )),
    screen('progress-bar', 'Progress bar', () => (
      <CardWrapper>
        <ProgressBar total={5} currentIndex={2} onBack={back} />
      </CardWrapper>
    )),
    screen('tile-assembly', 'Tile board', () => (
      <CardWrapper>
        <TileBoard item={TILE_ITEM} onResult={(r) => { log('onResult', r) }} onSpeak={speech.speakWord} embedded showAudio />
      </CardWrapper>
    )),
    screen('handoff-pencil', 'Handoff (paper write-out)', () => (
      <CardWrapper>
        <HandoffPencil word="tomato" onHearWord={() => { speech.speakWord('tomato') }} onWroteIt={() => { log('onWroteIt') }} />
      </CardWrapper>
    )),
    screen('parent-verify', 'Parent verify (PIN 1234)', () => (
      <CardWrapper>
        <ParentVerify word="tomato" kidName={MOCK_PROFILE.name} onResult={(correct) => { log('onResult', correct) }} />
      </CardWrapper>
    )),
    screen('rating-prompt', 'Rating prompt', () => (
      <CardWrapper>
        <RatingPrompt onRate={(v) => { log('onRate', v) }} onDismiss={() => { log('onDismiss') }} />
      </CardWrapper>
    )),
    screen('session-complete', 'Session complete', () => (
      <CardWrapper>
        <SessionComplete
          headline="You built them all!"
          subtitle="Five words, all put together. Nice work sounding them out."
          badgeSrc="/images/badges/syllable_builder.png"
          badgeTitle="Word Wizard badge"
          words={['cat', 'tomato', 'sun', 'pencil', 'garden']}
          onPlayAgain={() => { log('onPlayAgain') }}
          onAllDone={() => { log('onAllDone') }}
        />
      </CardWrapper>
    )),
    screen('writing-surface', 'Writing surface (drafting)', WritingSurfaceDemo),
    screen('coach-panel', 'Coach panel (revise & coach)', CoachPanelDemo),
    screen('modifier-deck', 'Modifier deck (draw + browse)', () => (
      <CardWrapper wide>
        <d.ModifierDeck onSelectCard={(c) => { log('onSelectCard', c) }} />
      </CardWrapper>
    )),
    screen('modifier-rule-bar', 'Modifier rule bar (pinned while writing)', () => (
      <CardWrapper wide>
        <ModifierRuleBar card={MOCK_MODIFIER_CARD} onRedraw={() => { log('onRedraw') }} onKeepWriting={() => { log('onKeepWriting') }} />
      </CardWrapper>
    )),
    screen('illustration-reveal', 'Illustration reveal (painting → hero → done)', () => (
      <CardWrapper>
        <d.IllustrationReveal
          pieceId="dev-demo"
          pieceTitle="The Ninety-Six Steps"
          wordCount={151}
          heroExcerpt="The steps smelled of cold salt and rust, and the ninety-sixth one always groaned like it was tired of her."
          moments={MOCK_MOMENTS}
          onReadItBack={() => { log('onReadItBack') }}
          onWriteSomethingElse={() => { log('onWriteSomethingElse') }}
        />
      </CardWrapper>
    )),
    screen('illustration-arrival', 'Illustration arrival (extra pictures for longer pieces)', () => (
      <CardWrapper>
        <IllustrationArrival items={MOCK_ARRIVAL} />
      </CardWrapper>
    )),
    screen('storybook', 'Storybook (live — hits the backend)', () => (
      <d.StoryLibrary profileId={MOCK_PROFILE.id} profileName={MOCK_PROFILE.name} onBack={back} onWriteNew={() => { log('onWriteNew') }} />
    )),
    screen('pathfinder-map-builder', 'Pathfinder: Map Builder (design new levels — saves to profile 1 on the backend)', () => (
      <CardWrapper wide>
        <d.PathfinderMapBuilder profileId={MOCK_PROFILE.id} username={MOCK_PROFILE.name} />
      </CardWrapper>
    )),
    screen('pathfinder-level-gallery', 'Pathfinder: All Levels (QA — every level unlocked, scores shown)', () => (
      <CardWrapper wide>
        <d.PathfinderLevelGallery />
      </CardWrapper>
    )),
    screen('storybook-entry-card', 'Storybook entry card (live — hits the backend)', () => (
      <CardWrapper>
        <d.StorybookEntryCard profileId={MOCK_PROFILE.id} onOpen={() => { log('onOpen') }} />
      </CardWrapper>
    )),
  ]
}
