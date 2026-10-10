import type { StorybookConfig } from '@storybook/react-vite'

// Stories are colocated with the UI they cover (<name>.<color>.ui.stories.tsx).
// Legacy components get stories as they migrate (MIGRATION.md).
const config: StorybookConfig = {
  framework: '@storybook/react-vite',
  stories: ['../src/**/*.stories.tsx'],
  addons: ['@storybook/addon-vitest'],
}

export default config
