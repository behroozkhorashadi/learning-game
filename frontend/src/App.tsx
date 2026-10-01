import { useState } from 'react'
import { ProfilePicker } from './games/ProfilePicker'
import { CreateProfile } from './games/CreateProfile'
import { EditProfile } from './games/EditProfile'
import { ProfileUnlock } from './games/ProfileUnlock'
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
import { Pathfinder } from './games/Pathfinder'
import { BadgesAccomplishments } from './components/BadgesAccomplishments'
import { Storybook } from './components/Storybook'
import { DevScreenPicker, DevScreenLink } from './dev/DevScreenPicker'
import type { Profile } from './types/generated'

function App() {
  const [profile, setProfile] = useState<Profile | null>(null)
  // The password that unlocked `profile` (its own, or the admin override),
  // kept in memory only so "Edit profile" doesn't ask again. Null for an
  // unprotected profile.
  const [profilePassword, setProfilePassword] = useState<string | null>(null)
  const [gameId, setGameId] = useState<string | null>(null)
  const [showBadges, setShowBadges] = useState(false)
  const [showStorybook, setShowStorybook] = useState(false)
  const [creatingProfile, setCreatingProfile] = useState(false)
  // A protected profile picked on ProfilePicker (to play, or via its edit
  // pencil) waiting on its password.
  const [unlocking, setUnlocking] = useState<{ profile: Profile; next: 'play' | 'edit' } | null>(null)
  // Set from either picker's pencil; `returnToGames` records which one so
  // Save/Cancel lands back where the edit started.
  const [editing, setEditing] = useState<{ profile: Profile; password: string | null; returnToGames: boolean } | null>(null)
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
        onCreated={(newProfile, password) => {
          setCreatingProfile(false)
          setProfile(newProfile)
          setProfilePassword(password)
        }}
        onCancel={() => setCreatingProfile(false)}
      />
    )
  } else if (unlocking != null) {
    content = (
      <ProfileUnlock
        profile={unlocking.profile}
        onUnlocked={(password) => {
          setUnlocking(null)
          if (unlocking.next === 'play') {
            setProfile(unlocking.profile)
            setProfilePassword(password)
          } else {
            setEditing({ profile: unlocking.profile, password, returnToGames: false })
          }
        }}
        onCancel={() => setUnlocking(null)}
      />
    )
  } else if (editing != null) {
    content = (
      <EditProfile
        profile={editing.profile}
        authHeaders={editing.password != null ? { 'X-Profile-Password': editing.password } : {}}
        onSaved={(updated, newPassword) => {
          setEditing(null)
          if (editing.returnToGames) {
            setProfile(updated)
            if (newPassword !== undefined) setProfilePassword(newPassword)
          }
        }}
        onCancel={() => setEditing(null)}
      />
    )
  } else if (profile == null) {
    content = (
      <ProfilePicker
        onSelect={(p) => {
          if (p.has_password) {
            setUnlocking({ profile: p, next: 'play' })
          } else {
            setProfile(p)
            setProfilePassword(null)
          }
        }}
        onAddPlayer={() => setCreatingProfile(true)}
        onEditProfile={(p) => {
          if (p.has_password) setUnlocking({ profile: p, next: 'edit' })
          else setEditing({ profile: p, password: null, returnToGames: false })
        }}
        onOpenAdmin={() => setShowAdmin(true)}
      />
    )
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
        onSwitchProfile={() => {
          setProfile(null)
          setProfilePassword(null)
        }}
        onEditProfile={() => setEditing({ profile, password: profilePassword, returnToGames: true })}
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
  } else if (gameId === 'pathfinder_no_way_back') {
    content = <Pathfinder profileId={profile.id!} profileName={profile.name} onBack={() => setGameId(null)} />
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
