import type { Meta, StoryObj } from '@storybook/react-vite'
import { ProfileAvatar } from './profile_avatar.pure.ui.tsx'

const meta = {
  title: 'app/profiles/ProfileAvatar',
  component: ProfileAvatar,
  args: { avatar: 'fox', name: 'Nora' },
  decorators: [
    (Story) => (
      <div style={{ width: 120, height: 120, borderRadius: 9999, overflow: 'hidden', background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 52, fontWeight: 800 }}>
        {Story()}
      </div>
    ),
  ],
} satisfies Meta<typeof ProfileAvatar>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const MissingArtFallsBackToInitial: Story = {
  args: { avatar: 'no-such-avatar', name: 'rami' },
}
