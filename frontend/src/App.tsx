import { useState } from 'react'
import { ProfilePicker } from './games/ProfilePicker'
import { GamePicker } from './games/GamePicker'
import { SyllableBuilder } from './games/SyllableBuilder'
import type { Profile } from './types/generated'

function App() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [gameId, setGameId] = useState<string | null>(null)

  if (profile == null) {
    return <ProfilePicker onSelect={setProfile} />
  }

  if (gameId == null) {
    return (
      <GamePicker
        profile={profile}
        onSelectGame={setGameId}
        onSwitchProfile={() => setProfile(null)}
      />
    )
  }

  return <SyllableBuilder profileId={profile.id!} profileName={profile.name} onBack={() => setGameId(null)} />
}

export default App
