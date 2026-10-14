import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import { LOADING, failed, loaded } from '@app/query/query_state.pure.lib.ts'
import { BadgesView } from './badges.pure.ui.tsx'
import { ART, BADGES, FIXTURE_NOW, NEW_PLAYER_STATS, STATS } from './badges_fixtures.test.lib.ts'

const meta = {
  title: 'app/badges/BadgesView',
  component: BadgesView,
  parameters: { layout: 'fullscreen' },
  args: { state: loaded({ badges: BADGES, stats: STATS }), gallery: loaded(ART), kidName: 'Mia', now: FIXTURE_NOW, onBack: fn(), painting: {}, onPaint: fn(), animate: true },
} satisfies Meta<typeof BadgesView>

export default meta
type Story = StoryObj<typeof meta>

export const Loaded: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await waitFor(async () => {
      await expect(canvas.getByRole('region', { name: 'Almost there' })).toBeVisible()
    })
    await waitFor(async () => {
      await expect(canvas.getByRole('img', { name: 'Comic Hero: a pet dragon' })).toBeVisible()
    })
  },
}

export const OpenALockedBadge: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(within(canvas.getByRole('region', { name: 'Right in a row' })).getByRole('button', { name: /^Sharpshooter: locked/ }))
    await expect(canvas.getByRole('region', { name: 'How to get it' })).toHaveTextContent('Get 25 answers right in a row')
    await waitFor(async () => {
      await expect(canvas.getByText('3 more to go!')).toBeVisible()
    })
  },
}

export const OpenAnEarnedBadge: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(within(canvas.getByRole('region', { name: 'Game masters' })).getByRole('button', { name: /^Zombie Slayer: earned/ }))
    await expect(canvas.getByRole('region', { name: 'Why you got it' })).toHaveTextContent('You got 100 answers right in Zombie Horde!')
    await userEvent.click(canvas.getByRole('button', { name: 'Try painting again' }))
    await expect(args.onPaint).toHaveBeenCalledWith('zombie-slayer')
  },
}

export const OpenTheStreak: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Day streak: 3. See the days you played' }))
    await waitFor(async () => {
      await expect(canvas.getByRole('heading', { name: '3 days in a row!' })).toBeVisible()
    })
    await expect(canvas.getByRole('region', { name: 'Day by day' })).toHaveTextContent('71 of 80 right')
  },
}

export const ParentView: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Switch to parent view' }))
    await waitFor(async () => {
      await expect(canvas.getByText('Learning insights')).toBeVisible()
    })
    await waitFor(async () => {
      await expect(canvas.getByText('4 days in a row')).toBeVisible()
    })
  },
}

export const NewPlayer: Story = { args: { state: loaded({ badges: [], stats: NEW_PLAYER_STATS }), gallery: loaded([]) } }

export const GalleryFails: Story = {
  args: { gallery: failed('GET /api/profiles/1/armory/art failed with HTTP 500') },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('alert')).toHaveTextContent('HTTP 500')
    await waitFor(async () => {
      await expect(canvas.getByRole('region', { name: 'Streaks' })).toBeVisible()
    })
  },
}

export const Loading: Story = { args: { state: LOADING } }

export const Failed: Story = {
  args: { state: failed('GET /api/profiles/1/badges failed with HTTP 500') },
  play: async ({ canvasElement }) => {
    await waitFor(async () => {
      await expect(within(canvasElement).getByRole('alert')).toBeVisible()
    })
  },
}
