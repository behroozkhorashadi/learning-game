import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState, type ReactElement } from 'react'
import { fn } from 'storybook/test'
import { INSTANT_TIMERS } from '@app/timing/manual_timers.test.lib.ts'
import { bindModifierDeck, type ModifierDeckProps } from './modifier_deck.effect.ui.tsx'

function Bound({ onSelectCard }: { readonly onSelectCard: ModifierDeckProps['onSelectCard'] }): ReactElement {
  const [ModifierDeck] = useState(() => bindModifierDeck({ timers: INSTANT_TIMERS, random: () => 0.5 }))
  return <ModifierDeck onSelectCard={onSelectCard} />
}

const meta = {
  title: 'app/writing/ModifierDeck',
  component: Bound,
  parameters: { layout: 'fullscreen' },
  args: { onSelectCard: fn() },
} satisfies Meta<typeof Bound>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
