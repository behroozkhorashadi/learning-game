import type { Meta, StoryObj } from '@storybook/react-vite'
import { ParentBadge } from './parent_badge.pure.ui.tsx'

const meta = { title: 'app/parents/ParentBadge', component: ParentBadge, args: { name: 'Mom', size: 96 } } satisfies Meta<typeof ParentBadge>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
