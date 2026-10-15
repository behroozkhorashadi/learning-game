import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState, type ReactElement } from 'react'
import { DevScreenPicker } from './dev_screen_picker.pure.ui.tsx'
import { bindDevScreens } from './dev_screens.effect.ui.tsx'

const NONE = (): null => null

/** The dev screens over no-op bound screens, opened on one demo. */
function Bound({ screen }: { readonly screen: string }): ReactElement {
  const [screens] = useState(() =>
    bindDevScreens({
  standalone: [],
  speech: { speakText: () => undefined, stopSpeaking: () => undefined, speakWord: () => undefined },
  log: () => undefined,
  ProfilePicker: NONE,
  CreateProfile: NONE,
  AdminPanel: NONE,
  GamePicker: NONE,
  OutbreakSettings: NONE,
  SyllableBuilder: NONE,
  ZombieMathBlaster: NONE,
  ZombieHorde: NONE,
  ZombiePOCScene: NONE,
  ZombieHitLab: NONE,
  WeaponPOCScene: NONE,
  Badges: NONE,
  StoryLibrary: NONE,
  StorybookEntryCard: NONE,
  PathfinderMapBuilder: NONE,
  PathfinderLevelGallery: NONE,
  IllustrationReveal: NONE,
  ModifierDeck: NONE,
    }),
  )
  return <DevScreenPicker screens={screens} screen={screen} />
}

const meta = {
  title: 'app/main/DevScreens',
  component: Bound,
  parameters: { layout: 'fullscreen' },
  args: { screen: 'coach-panel' },
} satisfies Meta<typeof Bound>

export default meta
type Story = StoryObj<typeof meta>

/** The mock-data coach panel, as the dev picker shows it. */
export const Default: Story = {}
