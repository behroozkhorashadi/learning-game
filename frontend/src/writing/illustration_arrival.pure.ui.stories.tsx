import type { Meta, StoryObj } from '@storybook/react-vite'
import { IllustrationArrival } from './illustration_arrival.pure.ui.tsx'

const meta = {
  title: 'app/writing/IllustrationArrival',
  component: IllustrationArrival,
  args: { items: [{ kicker: 'Page 2', quote: 'The bus stopped at the edge of the fog.' }, { kicker: 'Page 3', quote: 'The crow laughed at the map.' }] },
} satisfies Meta<typeof IllustrationArrival>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
