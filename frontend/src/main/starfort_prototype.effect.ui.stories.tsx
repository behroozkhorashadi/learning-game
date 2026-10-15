import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState, type ReactElement } from 'react'
import { bindStarfortPrototype } from './starfort_prototype.effect.ui.tsx'

function Bound(): ReactElement {
  const [StarfortPrototype] = useState(() => bindStarfortPrototype({ src: '/prototypes/starfort.html' }))
  return <StarfortPrototype />
}

const meta = {
  title: 'app/main/StarfortPrototype',
  component: Bound,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof Bound>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
