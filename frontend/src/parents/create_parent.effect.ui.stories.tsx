import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState, type ReactElement } from 'react'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import type { ParentRecord } from '@app/api/parents_schema.pure.lib.ts'
import { bindCreateParent } from './create_parent.effect.ui.tsx'
import { MOM } from './parents_fixtures.test.lib.ts'

/** The real bound screen over a fake create. */
function Bound({ onCreated }: { readonly onCreated: (parent: ParentRecord, password: string) => void }): ReactElement {
  const [CreateParent] = useState(() => bindCreateParent({ createParent: () => Promise.resolve(MOM) }))
  return <CreateParent onCreated={onCreated} onCancel={fn()} />
}

const meta = { title: 'app/parents/CreateParent', component: Bound, parameters: { layout: 'fullscreen' }, args: { onCreated: fn() } } satisfies Meta<typeof Bound>

export default meta
type Story = StoryObj<typeof meta>

export const MakeAnAccount: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.type(canvas.getByLabelText('Your name'), 'Mom')
    await userEvent.type(canvas.getByLabelText('Password'), 'abcd')
    await userEvent.type(canvas.getByLabelText('Password again'), 'abcd')
    await userEvent.click(canvas.getByRole('button', { name: 'Create parent account' }))
    await waitFor(async () => {
      await expect(args.onCreated).toHaveBeenCalledWith(MOM, 'abcd')
    })
  },
}
