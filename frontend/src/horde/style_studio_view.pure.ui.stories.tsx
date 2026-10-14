import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import type { ArmoryLooksRecord } from '@app/api/armory_schema.pure.lib.ts'
import { picture } from '@app/profiles/profile_photo_fixtures.test.lib.ts'
import { loaded } from '@app/query/query_state.pure.lib.ts'
import { DEFAULT_LOOKS, gearLookFor } from './horde_looks.pure.lib.ts'
import { StyleStudioView, type UnlockOffer } from './style_studio_view.pure.ui.tsx'

const offer = (id: string, name: string, description: string, price: number, owned: boolean): UnlockOffer => ({ id, name, description, price, owned })

const ART = [
  { id: 'art-1', profile_id: 1, image_url: picture('#9D57FA'), style: 'comic_hero', idea: 'a dragon', created_at: '2026-10-11T12:00:00Z' },
  { id: 'art-2', profile_id: 1, image_url: picture('#5BCC2D'), style: 'pixel_hero', idea: '', created_at: '2026-10-11T12:00:00Z' },
] as const

const DESIGNED: ArmoryLooksRecord = { skin_id: null, suit_paint: { color: '#EC407A', shine: 'glow' }, blaster_color: '#29B6F6', emblem: { symbol: 'dino', art_id: null, color: '#FDD835', place: 'both' }, hung: { pathfinder: 'art-1', horde: null } }

const meta = {
  title: 'app/horde/StyleStudioView',
  component: StyleStudioView,
  args: {
    balance: 180,
    unlocks: {
      suitPaint: offer('suit_paint', 'Suit Paint Studio', 'Paint your armor any colour you like: matte, shiny, or glowing.', 150, true),
      blasterPaint: offer('blaster_paint', 'Blaster Paint', 'Paint your blaster any colour you like.', 150, true),
      emblem: offer('emblem_maker', 'Emblem Maker', 'Design your own badge for your arm or blaster: a symbol, or one of your art pieces.', 120, true),
      pathfinder: offer('pathfinder_frame', 'Pathfinder Backdrop', 'Hang one of your art pieces behind the Pathfinder board.', 100, true),
      horde: offer('horde_billboard', 'Horde Billboard', 'Hang one of your art pieces on a giant billboard in Zombie Horde.', 100, false),
    },
    looks: DESIGNED,
    preview: gearLookFor({ looks: DESIGNED, pictures: {} }, []),
    gallery: loaded(ART),
    buying: null,
    dirty: true,
    saving: false,
    saved: false,
    error: null,
    onChange: fn(),
    onBuy: fn(),
    onSave: fn(),
    onBack: fn(),
  },
} satisfies Meta<typeof StyleStudioView>

export default meta
type Story = StoryObj<typeof meta>

/** Everything unlocked but the billboard, with a glowing pink suit, a sky-blue blaster, and a dino emblem. */
export const Designing: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Save my look' }))
    await expect(args.onSave).toHaveBeenCalled()
    await userEvent.click(canvas.getByRole('button', { name: 'Unlock Horde Billboard for 100 points' }))
    await expect(args.onBuy).toHaveBeenCalledWith('horde_billboard')
  },
}

/** A fresh studio: nothing unlocked yet, and not enough points for everything. */
export const AllLocked: Story = {
  args: {
    balance: 130,
    looks: DEFAULT_LOOKS,
    preview: gearLookFor({ looks: DEFAULT_LOOKS, pictures: {} }, []),
    dirty: false,
    unlocks: {
      suitPaint: offer('suit_paint', 'Suit Paint Studio', 'Paint your armor any colour you like: matte, shiny, or glowing.', 150, false),
      blasterPaint: offer('blaster_paint', 'Blaster Paint', 'Paint your blaster any colour you like.', 150, false),
      emblem: offer('emblem_maker', 'Emblem Maker', 'Design your own badge for your arm or blaster: a symbol, or one of your art pieces.', 120, false),
      pathfinder: offer('pathfinder_frame', 'Pathfinder Backdrop', 'Hang one of your art pieces behind the Pathfinder board.', 100, false),
      horde: offer('horde_billboard', 'Horde Billboard', 'Hang one of your art pieces on a giant billboard in Zombie Horde.', 100, false),
    },
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('button', { name: 'Unlock Emblem Maker for 120 points' })).toBeVisible()
  },
}
