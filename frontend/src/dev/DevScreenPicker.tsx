import type { ReactNode } from 'react'
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

function CardWrapper({ children }: { children: ReactNode }) {
  return (
    <div style={{ minHeight: '100%', boxSizing: 'border-box', background: 'var(--surface-app)', display: 'flex', justifyContent: 'center', padding: '32px 24px 56px' }}>
      <div style={{ width: '100%', maxWidth: 760, display: 'flex', flexDirection: 'column', gap: 24 }}>{children}</div>
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
      />
    ),
  },
  {
    id: 'syllable-builder',
    label: 'Syllable Builder (live — hits the backend)',
    render: () => <SyllableBuilder profileId={1} profileName="Mia" onBack={() => console.log('onBack')} />,
  },
  {
    id: 'badges',
    label: 'Badges & Accomplishments',
    render: () => <BadgesAccomplishments kidName="Mia" onBack={() => console.log('onBack')} />,
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
