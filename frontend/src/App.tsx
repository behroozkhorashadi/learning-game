import { useState } from 'react'
import { ProfilePicker } from './games/ProfilePicker'
import { CreateProfile } from './games/CreateProfile'
import { AdminPanel } from './games/AdminPanel'
import { EquationOutbreakSettings } from './games/EquationOutbreakSettings'
import { GamePicker } from './games/GamePicker'
import { SyllableBuilder } from './games/SyllableBuilder'
import { EquationBuilder } from './games/EquationBuilder'
import { ZombieMathBlaster } from './games/ZombieMathBlaster'
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
  const [creatingProfile, setCreatingProfile] = useState(false)
  const [showAdmin, setShowAdmin] = useState(false)
  const [practiceSettingsGameId, setPracticeSettingsGameId] = useState<string | null>(null)

  if (import.meta.env.DEV) {
    const screen = new URLSearchParams(window.location.search).get('screen')
    if (screen) {
      return <DevScreenPicker screen={screen} />
    }
  }

  let content
  if (showAdmin) {
    content = <AdminPanel onClose={() => setShowAdmin(false)} />
  } else if (creatingProfile) {
    content = (
      <CreateProfile
        onCreated={(newProfile) => {
          setCreatingProfile(false)
          setProfile(newProfile)
        }}
        onCancel={() => setCreatingProfile(false)}
      />
    )
  } else if (profile == null) {
    content = <ProfilePicker onSelect={setProfile} onAddPlayer={() => setCreatingProfile(true)} onOpenAdmin={() => setShowAdmin(true)} />
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
  } else if (practiceSettingsGameId === 'fact_fluency') {
    content = <EquationOutbreakSettings profileId={profile.id!} onBack={() => setPracticeSettingsGameId(null)} />
  } else if (gameId == null) {
    content = (
      <GamePicker
        profile={profile}
        onSelectGame={setGameId}
        onSwitchProfile={() => setProfile(null)}
        onViewBadges={() => setShowBadges(true)}
        onOpenStorybook={() => setShowStorybook(true)}
        onOpenPracticeSettings={setPracticeSettingsGameId}
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
  } else if (gameId === 'equation_builder') {
    content = <EquationBuilder profileId={profile.id!} profileName={profile.name} onBack={() => setGameId(null)} />
  } else if (gameId === 'fact_fluency') {
    content = <ZombieMathBlaster profileId={profile.id!} profileName={profile.name} onBack={() => setGameId(null)} />
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
