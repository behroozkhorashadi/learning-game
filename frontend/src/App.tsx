import { useState } from 'react'
import { ProfilePicker } from './games/ProfilePicker'
import { SyllableBuilder } from './games/SyllableBuilder'

function App() {
  const [profileId, setProfileId] = useState<number | null>(null)

  if (profileId == null) {
    return <ProfilePicker onSelect={setProfileId} />
  }
  return <SyllableBuilder profileId={profileId} onBack={() => setProfileId(null)} />
}

export default App
