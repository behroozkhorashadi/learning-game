import type { Meta, StoryObj } from '@storybook/react-vite'
import { use, type ReactElement } from 'react'
import { expect, within } from 'storybook/test'
import { AsyncBoundary } from './async_boundary.pure.ui.tsx'

/**
 * A load that starts on first call and is then memoized. Starting it during
 * render means React observes a rejection immediately (never unhandled), and
 * memoizing outside the component survives the suspended first mount.
 */
function once(load: () => Promise<string>): () => Promise<string> {
  let started: Promise<string> | null = null
  return () => (started ??= load())
}

function Reads({ load }: { readonly load: () => Promise<string> }): ReactElement {
  return <p>{use(load())}</p>
}

const meta = {
  title: 'app/boundary/AsyncBoundary',
  component: AsyncBoundary,
  args: {
    loading: <p>Loading…</p>,
    failed: (error: unknown) => <p role="alert">{error instanceof Error ? error.message : 'Something went wrong'}</p>,
    children: null,
  },
} satisfies Meta<typeof AsyncBoundary>

export default meta
type Story = StoryObj<typeof meta>

export const Loaded: Story = {
  args: { children: <Reads load={once(() => Promise.resolve('Ready'))} /> },
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByText('Ready')).toBeVisible()
  },
}

export const Loading: Story = {
  args: { children: <Reads load={once(() => new Promise<string>(() => undefined))} /> },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('Loading…')).toBeVisible()
  },
}

export const Failed: Story = {
  args: { children: <Reads load={once(() => Promise.reject(new Error('Could not load')))} /> },
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByRole('alert')).toHaveTextContent('Could not load')
  },
}
