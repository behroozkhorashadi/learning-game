import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState, type ReactElement } from 'react'
import { expect, fn, userEvent, within } from 'storybook/test'
import { bindParentLogin } from './parent_login.effect.ui.tsx'
import { MOM } from './parents_fixtures.test.lib.ts'

/** The real bound sign-in over a fake unlock whose password is "secret". */
function Bound({ onSignedIn }: { readonly onSignedIn: (password: string) => void }): ReactElement {
  const [Login] = useState(() => bindParentLogin({ unlockParent: (_id, password) => Promise.resolve(password === 'secret' ? 'unlocked' : 'wrong-password') }))
  return <Login parent={MOM} onSignedIn={onSignedIn} onCancel={fn()} />
}

const meta = { title: 'app/parents/ParentLogin', component: Bound, parameters: { layout: 'fullscreen' }, args: { onSignedIn: fn() } } satisfies Meta<typeof Bound>

export default meta
type Story = StoryObj<typeof meta>

export const WrongThenRight: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.type(canvas.getByLabelText('Password'), 'nope{Enter}')
    await expect(await canvas.findByRole('alert')).toHaveTextContent('That password didn’t work.')
    await userEvent.type(canvas.getByLabelText('Password'), 'secret{Enter}')
    await expect(args.onSignedIn).toHaveBeenCalledWith('secret')
  },
}
