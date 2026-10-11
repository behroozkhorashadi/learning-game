import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { EquationDisplay } from './equation_display.pure.ui.tsx'
import { equation } from './equation_fixtures.test.lib.ts'

const meta = {
  title: 'app/equation_builder/EquationDisplay',
  component: EquationDisplay,
  args: { payload: equation(7, []) },
} satisfies Meta<typeof EquationDisplay>

export default meta
type Story = StoryObj<typeof meta>

export const MissingAnswer: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('img', { name: 'missing' })).toBeVisible()
  },
}

export const MissingOperator: Story = { args: { payload: { ...equation(7, []), missing: 'operator' } } }
