import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState, type ReactElement } from 'react'
import { expect, fn, userEvent, within } from 'storybook/test'
import { bindErrorBoundary } from './error_boundary.effect.ui.tsx'

function Bomb(): never {
  throw new Error('kaboom (expected, from the story)')
}

/** The bound boundary around a child that throws, with fake report and reload. */
function Bound({ reload }: { readonly reload: () => void }): ReactElement {
  const [ErrorBoundary] = useState(() => bindErrorBoundary({ report: fn(), reload }))
  return (
    <ErrorBoundary>
      <Bomb />
    </ErrorBoundary>
  )
}

const meta = {
  title: 'app/errors/ErrorBoundary',
  component: Bound,
  parameters: { layout: 'fullscreen' },
  args: { reload: fn() },
} satisfies Meta<typeof Bound>

export default meta
type Story = StoryObj<typeof meta>

export const Tripped: Story = {
  play: async ({ args, canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Try again' }))
    await expect(args.reload).toHaveBeenCalled()
  },
}
