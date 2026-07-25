import { useState } from 'react'
import { ProfilePicker } from './games/ProfilePicker'
import { GamePicker } from './games/GamePicker'
import { SyllableBuilder } from './games/SyllableBuilder'
import { BadgesAccomplishments } from './components/BadgesAccomplishments'
import { DevScreenPicker, DevScreenLink } from './dev/DevScreenPicker'
import type { Profile } from './types/generated'

function App() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [gameId, setGameId] = useState<string | null>(null)
  const [showBadges, setShowBadges] = useState(false)

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
    content = <BadgesAccomplishments kidName={profile.name} onBack={() => setShowBadges(false)} />
  } else if (gameId == null) {
    content = (
      <GamePicker
        profile={profile}
        onSelectGame={setGameId}
        onSwitchProfile={() => setProfile(null)}
        onViewBadges={() => setShowBadges(true)}
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
