import { useState, type ReactNode } from 'react'
import { ProfilePicker } from '../games/ProfilePicker'
import { GamePicker } from '../games/GamePicker'
import { SyllableBuilder } from '../games/SyllableBuilder'
import { BadgesAccomplishments } from '../components/BadgesAccomplishments'
import { SessionStart } from '../components/SessionStart'
import { ProgressBar } from '../components/ProgressBar'
import { TileAssembly, type TileAssemblyItem } from '../components/TileAssembly'
import { HandoffPencil } from '../components/HandoffPencil'
import { ParentVerify } from '../components/ParentVerify'
import { RatingPrompt } from '../components/RatingPrompt'
import { SessionComplete } from '../components/SessionComplete'
import { WritingSurface } from '../components/WritingSurface'
import { CoachPanel, type CoachQuestion } from '../components/CoachPanel'
import { ModifierDeck, ModifierRuleBar, type ModifierCard } from '../components/ModifierDeck'
import { IllustrationReveal, IllustrationArrival } from '../components/IllustrationReveal'
import { Storybook } from '../components/Storybook'
import { StorybookEntryCard } from '../components/StorybookEntryCard'
import { ZombiePOCScene } from './ZombiePOCScene'
import { ZombieMathBlaster } from '../games/ZombieMathBlaster'
import type { Profile } from '../types/generated'

/**
 * Dev-only screen picker (`?screen=<id>`, `import.meta.env.DEV`-gated) so any
 * screen can be opened directly with mock data instead of playing through
 * ProfilePicker -> GamePicker -> a full session every time. Never imported
 * outside of `App.tsx`'s DEV branch, so it's excluded from production builds.
 */

const MOCK_PROFILE: Profile = { id: 1, name: 'Mia', avatar: 'fox', birth_year: 2019 }

const TILE_ITEM: TileAssemblyItem = {
  kind: 'word',
  instruction: 'Put the sounds in order to build the word',
  spoken: 'tomato',
  slots: 3,
  answer: ['to', 'ma', 'to'],
  tiles: [
    { id: 'to-0', label: 'to' },
    { id: 'ma-1', label: 'ma' },
    { id: 'to-2', label: 'to' },
  ],
}

const MOCK_QUESTIONS: CoachQuestion[] = [
  { id: 'opening', kind: 'opening', text: "Your story starts fast — I'm already on the stairs. What did the inside of the lighthouse look like when she opened the door?", answered: true },
  { id: 'word-choice', kind: 'wordChoice', text: 'You used "nice" twice. What kind of nice was it — quiet? cold? lonely? Got a stronger word?', answered: true },
  { id: 'feeling', kind: 'feeling', text: 'You told me she promised. How did her voice sound when she said it out loud?', answered: false },
]

function WritingSurfaceDemo() {
  const [value, setValue] = useState(
    'The lighthouse had been dark for eleven years, and Nell was the only one on the island who still climbed it. Every Tuesday she carried a jar of oil up the ninety-six steps, even though there was nothing left to light.',
  )
  return (
    <WritingSurface
      briefTitle="Write a story about someone who keeps a promise nobody is watching them keep."
      briefBody="You have three ingredients to work in. Use them however you like — you don't have to use them in order."
      briefChips={['a lighthouse', 'eleven years', 'one jar of oil']}
      value={value}
      onChange={setValue}
      wordGoal={40}
      onPolish={() => console.log('onPolish')}
      onKeepWriting={() => console.log('onKeepWriting')}
    />
  )
}

function CoachPanelDemo() {
  const [value, setValue] = useState(
    'The lighthouse had been dark for eleven years, and Nell was the only one on the island who still climbed it. Every Tuesday she carried a jar of oil up the ninety-six steps, even though there was nothing left to light.',
  )
  return (
    <CoachPanel
      pieceTitle="The Ninety-Six Steps"
      value={value}
      onChange={setValue}
      status="questions"
      questions={MOCK_QUESTIONS}
      onHappy={() => console.log('onHappy')}
    />
  )
}

const MOCK_MODIFIER_CARD: ModifierCard = {
  id: 'second',
  tier: 'twist',
  name: 'Second Person',
  meaning: 'Tell it as "you". The reader is the one doing it.',
  example: "You climb anyway, even though you promised you wouldn't.",
  iconPaths: [
    'M12 3.75V8.25M12 8.25L9.75 6.25M12 8.25L14.25 6.25',
    'M18.25 13.5C18.25 16.9518 15.4518 19.75 12 19.75C8.54822 19.75 5.75 16.9518 5.75 13.5C5.75 10.0482 8.54822 7.25 12 7.25C15.4518 7.25 18.25 10.0482 18.25 13.5Z',
    'M13 13.5C13 14.0523 12.5523 14.5 12 14.5C11.4477 14.5 11 14.0523 11 13.5C11 12.9477 11.4477 12.5 12 12.5C12.5523 12.5 13 12.9477 13 13.5Z',
  ],
}

function ModifierRuleBarDemo() {
  return <ModifierRuleBar card={MOCK_MODIFIER_CARD} onRedraw={() => console.log('onRedraw')} onKeepWriting={() => console.log('onKeepWriting')} />
}

const MOCK_MOMENTS = ['The lighthouse had been dark for eleven years.', "She promised — out loud, at the funeral, in front of everyone."]

function IllustrationRevealDemo() {
  return (
    <IllustrationReveal
      pieceId="dev-demo"
      pieceTitle="The Ninety-Six Steps"
      wordCount={151}
      heroExcerpt="The steps smelled of cold salt and rust, and the ninety-sixth one always groaned like it was tired of her."
      moments={MOCK_MOMENTS}
      onReadItBack={() => console.log('onReadItBack')}
      onWriteSomethingElse={() => console.log('onWriteSomethingElse')}
    />
  )
}

const MOCK_ARRIVAL: { kicker: string; quote: string }[] = [
  { kicker: 'Arrived first · the hero', quote: 'The steps smelled of cold salt and rust.' },
  { kicker: 'Then, a moment later', quote: 'The lighthouse had been dark for eleven years.' },
  { kicker: 'And the last one', quote: 'She promised — out loud, at the funeral.' },
]

function CardWrapper({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return (
    <div style={{ minHeight: '100%', boxSizing: 'border-box', background: 'var(--surface-app)', display: 'flex', justifyContent: 'center', padding: '32px 24px 56px' }}>
      <div style={{ width: '100%', maxWidth: wide ? 1180 : 760, display: 'flex', flexDirection: 'column', gap: 24 }}>{children}</div>
    </div>
  )
}

interface ScreenEntry {
  id: string
  label: string
  render: () => ReactNode
}

const SCREENS: ScreenEntry[] = [
  {
    id: 'profile-picker',
    label: 'Profile picker',
    render: () => <ProfilePicker onSelect={(p) => console.log('onSelect', p)} />,
  },
  {
    id: 'game-picker',
    label: 'Game picker',
    render: () => (
      <GamePicker
        profile={MOCK_PROFILE}
        onSelectGame={(id) => console.log('onSelectGame', id)}
        onSwitchProfile={() => console.log('onSwitchProfile')}
        onViewBadges={() => console.log('onViewBadges')}
        onOpenStorybook={() => console.log('onOpenStorybook')}
      />
    ),
  },
  {
    id: 'syllable-builder',
    label: 'Syllable Builder (live — hits the backend)',
    render: () => <SyllableBuilder profileId={1} profileName="Mia" onBack={() => console.log('onBack')} />,
  },
  {
    id: 'zombie-3d-poc',
    label: 'Equation Outbreak 3D character POC',
    render: () => <ZombiePOCScene />,
  },
  {
    id: 'equation-outbreak-live',
    label: 'Equation Outbreak (live — hits the backend)',
    render: () => <ZombieMathBlaster profileId={1} profileName="Mia" onBack={() => console.log('onBack')} />,
  },
  {
    id: 'badges',
    label: 'Badges & Accomplishments',
    render: () => <BadgesAccomplishments profileId={1} kidName="Mia" onBack={() => console.log('onBack')} />,
  },
  {
    id: 'session-start',
    label: 'Session start',
    render: () => (
      <CardWrapper>
        <SessionStart
          eyebrow="Word building"
          headline="Let's build some words"
          subtitle="Slide the sounds together to make five words. Take your time — there's no clock."
          sessionLength={5}
          heroSrc="/images/badges/syllable_builder.png"
          onStart={() => console.log('onStart')}
          onBack={() => console.log('onBack')}
        />
      </CardWrapper>
    ),
  },
  {
    id: 'progress-bar',
    label: 'Progress bar',
    render: () => (
      <CardWrapper>
        <ProgressBar total={5} currentIndex={2} onBack={() => console.log('onBack')} />
      </CardWrapper>
    ),
  },
  {
    id: 'tile-assembly',
    label: 'Tile Assembly',
    render: () => (
      <CardWrapper>
        <TileAssembly item={TILE_ITEM} onResult={(r) => console.log('onResult', r)} embedded showAudio />
      </CardWrapper>
    ),
  },
  {
    id: 'handoff-pencil',
    label: 'Handoff (paper write-out)',
    render: () => (
      <CardWrapper>
        <HandoffPencil word="tomato" onWroteIt={() => console.log('onWroteIt')} />
      </CardWrapper>
    ),
  },
  {
    id: 'parent-verify',
    label: 'Parent verify (PIN 1234)',
    render: () => (
      <CardWrapper>
        <ParentVerify word="tomato" kidName="Mia" onResult={(correct) => console.log('onResult', correct)} />
      </CardWrapper>
    ),
  },
  {
    id: 'rating-prompt',
    label: 'Rating prompt',
    render: () => (
      <CardWrapper>
        <RatingPrompt onRate={(v) => console.log('onRate', v)} onDismiss={() => console.log('onDismiss')} />
      </CardWrapper>
    ),
  },
  {
    id: 'session-complete',
    label: 'Session complete',
    render: () => (
      <CardWrapper>
        <SessionComplete
          headline="You built them all!"
          subtitle="Five words, all put together. Nice work sounding them out."
          badgeSrc="/images/badges/syllable_builder.png"
          badgeTitle="Word Wizard badge"
          words={['cat', 'tomato', 'sun', 'pencil', 'garden']}
          onPlayAgain={() => console.log('onPlayAgain')}
          onAllDone={() => console.log('onAllDone')}
        />
      </CardWrapper>
    ),
  },
  {
    id: 'writing-surface',
    label: 'Writing surface (drafting)',
    render: () => (
      <CardWrapper wide>
        <WritingSurfaceDemo />
      </CardWrapper>
    ),
  },
  {
    id: 'coach-panel',
    label: 'Coach panel (revise & coach)',
    render: () => (
      <CardWrapper wide>
        <CoachPanelDemo />
      </CardWrapper>
    ),
  },
  {
    id: 'modifier-deck',
    label: 'Modifier deck (draw + browse)',
    render: () => (
      <CardWrapper wide>
        <ModifierDeck onSelectCard={(c) => console.log('onSelectCard', c)} />
      </CardWrapper>
    ),
  },
  {
    id: 'modifier-rule-bar',
    label: 'Modifier rule bar (pinned while writing)',
    render: () => (
      <CardWrapper wide>
        <ModifierRuleBarDemo />
      </CardWrapper>
    ),
  },
  {
    id: 'illustration-reveal',
    label: 'Illustration reveal (painting → hero → done)',
    render: () => (
      <CardWrapper>
        <IllustrationRevealDemo />
      </CardWrapper>
    ),
  },
  {
    id: 'illustration-arrival',
    label: 'Illustration arrival (extra pictures for longer pieces)',
    render: () => (
      <CardWrapper>
        <IllustrationArrival items={MOCK_ARRIVAL} />
      </CardWrapper>
    ),
  },
  {
    id: 'storybook',
    label: 'Storybook (live — hits the backend)',
    render: () => <Storybook profileId={1} profileName="Mia" onBack={() => console.log('onBack')} onWriteNew={() => console.log('onWriteNew')} />,
  },
  {
    id: 'storybook-entry-card',
    label: 'Storybook entry card (live — hits the backend)',
    render: () => (
      <CardWrapper>
        <StorybookEntryCard profileId={1} onOpen={() => console.log('onOpen')} />
      </CardWrapper>
    ),
  },
]

export function DevScreenLink() {
  return (
    <a
      href="?screen=index"
      style={{
        position: 'fixed',
        bottom: 12,
        right: 12,
        zIndex: 9999,
        background: '#2A2E37',
        color: '#FFFFFF',
        fontFamily: 'var(--font-sans)',
        fontSize: 13,
        fontWeight: 700,
        padding: '8px 14px',
        borderRadius: 9999,
        textDecoration: 'none',
        boxShadow: '0 6px 16px -6px rgba(0,0,0,0.4)',
      }}
    >
      Dev screens
    </a>
  )
}

export function DevScreenPicker({ screen }: { screen: string }) {
  const entry = SCREENS.find((s) => s.id === screen)

  if (!entry) {
    return (
      <div style={{ minHeight: '100%', boxSizing: 'border-box', padding: 40, fontFamily: 'var(--font-sans)' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, marginBottom: 16 }}>Dev screens</h1>
        <p style={{ color: '#8896AA', marginBottom: 24 }}>
          Pick a screen to render standalone with mock data. Drop <code>?screen=</code> from the URL to return to the real app.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 420 }}>
          {SCREENS.map((s) => (
            <a
              key={s.id}
              href={`?screen=${s.id}`}
              style={{ display: 'block', padding: '14px 18px', borderRadius: 14, background: '#FFFFFF', border: '1px solid #EEE4D2', textDecoration: 'none', color: '#2A2E37', fontWeight: 700 }}
            >
              {s.label}
            </a>
          ))}
        </div>
      </div>
    )
  }

  return (
    <>
      {entry.render()}
      <DevScreenLink />
    </>
  )
}
