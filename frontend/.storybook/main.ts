import type { StorybookConfig } from '@storybook/react-vite'

// Stories are colocated with the UI they cover (<name>.<color>.ui.stories.tsx). They're a
// visual catalog: `make storybook-test` (and nightly CI) renders each one in Chrome, minus the
// WebGL ones tagged '!test'. Behavior is tested by the unit tests, not by play functions.
const config: StorybookConfig = {
  framework: '@storybook/react-vite',
  stories: ['../src/**/*.stories.tsx'],
  addons: ['@storybook/addon-vitest'],
}

export default config
