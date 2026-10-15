import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { cardById } from './modifier_cards.pure.lib.ts'
import { ModifierRuleBar } from './modifier_rule_bar.pure.ui.tsx'

const meta = {
  title: 'app/writing/ModifierRuleBar',
  component: ModifierRuleBar,
  args: { card: cardById('second'), onRedraw: fn(), onKeepWriting: fn() },
} satisfies Meta<typeof ModifierRuleBar>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
