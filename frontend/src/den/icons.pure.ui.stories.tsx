import type { Meta, StoryObj } from '@storybook/react-vite'
import type { ComponentType, ReactElement } from 'react'
import { expect, within } from 'storybook/test'
import * as icons from './icons.pure.ui.tsx'

const ICONS: readonly [string, ComponentType<{ readonly size?: number }>][] = Object.entries(icons)

function Gallery({ size }: { readonly size: number }): ReactElement {
  return (
    <ul style={{ display: 'flex', flexWrap: 'wrap', gap: 16, listStyle: 'none', padding: 0, color: '#2A2E37' }}>
      {ICONS.map(([name, Icon]) => (
        <li key={name} aria-label={name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, fontSize: 12 }}>
          <Icon size={size} />
          {name}
        </li>
      ))}
    </ul>
  )
}

const meta = {
  title: 'app/den/Icons',
  component: Gallery,
  args: { size: 32 },
} satisfies Meta<typeof Gallery>

export default meta
type Story = StoryObj<typeof meta>

export const All: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getAllByRole('listitem')).toHaveLength(ICONS.length)
  },
}
