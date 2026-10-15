import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState, type ReactElement } from 'react'
import { fn } from 'storybook/test'
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

export const Default: Story = {}
