import { useState } from 'react'
import { ProfilePicker } from './games/ProfilePicker'
import { GamePicker } from './games/GamePicker'
import { SyllableBuilder } from './games/SyllableBuilder'
import { PromptForge } from './games/PromptForge'
import { StyleRemixLab } from './games/StyleRemixLab'
import { TagTeamStory } from './games/TagTeamStory'
import { ClueMaster } from './games/ClueMaster'
import { BadgesAccomplishments } from './components/BadgesAccomplishments'
import { Storybook } from './components/Storybook'
import { DevScreenPicker, DevScreenLink } from './dev/DevScreenPicker'
import type { Profile } from './types/generated'

function App() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [gameId, setGameId] = useState<string | null>(null)
  const [showBadges, setShowBadges] = useState(false)
  const [showStorybook, setShowStorybook] = useState(false)

  if (import.meta.env.DEV) {
    const screen = new URLSearchParams(window.location.search).get('screen')
    if (screen) {
      return <DevScreenPicker screen={screen} />
    }
  }

  let content
  if (profile == null) {
    content = <ProfilePicker onSelect={setProfile} />
  } else if (showBadges) {
    content = <BadgesAccomplishments profileId={profile.id!} kidName={profile.name} onBack={() => setShowBadges(false)} />
  } else if (showStorybook) {
    content = (
      <Storybook
        profileId={profile.id!}
        profileName={profile.name}
        onBack={() => setShowStorybook(false)}
        onWriteNew={() => setShowStorybook(false)}
      />
    )
  } else if (gameId == null) {
    content = (
      <GamePicker
        profile={profile}
        onSelectGame={setGameId}
        onSwitchProfile={() => setProfile(null)}
        onViewBadges={() => setShowBadges(true)}
        onOpenStorybook={() => setShowStorybook(true)}
      />
    )
  } else if (gameId === 'prompt_forge') {
    content = (
      <PromptForge
        profileId={profile.id!}
        profileName={profile.name}
        onBack={() => setGameId(null)}
        onFinished={() => {
          setGameId(null)
          setShowStorybook(true)
        }}
      />
    )
  } else if (gameId === 'style_remix_lab') {
    content = (
      <StyleRemixLab
        profileId={profile.id!}
        profileName={profile.name}
        onBack={() => setGameId(null)}
        onFinished={() => {
          setGameId(null)
          setShowStorybook(true)
        }}
      />
    )
  } else if (gameId === 'tag_team_story') {
    content = (
      <TagTeamStory
        profileId={profile.id!}
        profileName={profile.name}
        onBack={() => setGameId(null)}
        onFinished={() => {
          setGameId(null)
          setShowStorybook(true)
        }}
      />
    )
  } else if (gameId === 'clue_master') {
    content = (
      <ClueMaster
        profileId={profile.id!}
        profileName={profile.name}
        onBack={() => setGameId(null)}
        onFinished={() => {
          setGameId(null)
          setShowStorybook(true)
        }}
      />
    )
  } else {
    content = <SyllableBuilder profileId={profile.id!} profileName={profile.name} onBack={() => setGameId(null)} />
  }

  return (
    <>
      {content}
      {import.meta.env.DEV && <DevScreenLink />}
    </>
  )
}

export default App
