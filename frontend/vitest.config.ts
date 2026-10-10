import { fileURLToPath } from 'node:url'
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin'
import react from '@vitejs/plugin-react'
import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

const alias = { '@app': fileURLToPath(new URL('./src', import.meta.url)) }

// Locally, drive the installed Google Chrome (as the e2e suite does); CI installs Playwright's chromium.
const browserProvider = process.env['CI'] === undefined ? playwright({ launchOptions: { channel: 'chrome' } }) : playwright()

export default defineConfig({
  plugins: [react()],
  resolve: { alias },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          environment: 'jsdom',
          include: ['src/**/*.test.{ts,tsx}'],
          // Playwright e2e specs run on demand via `npm run e2e`, never here/CI.
          exclude: ['**/node_modules/**', 'e2e/**'],
        },
      },
      {
        extends: true,
        test: {
          name: 'tooling',
          environment: 'node',
          include: ['scripts/**/*.test.ts'],
        },
      },
      {
        extends: true,
        plugins: [storybookTest({ configDir: fileURLToPath(new URL('./.storybook', import.meta.url)) })],
        test: {
          name: 'storybook',
          browser: { enabled: true, headless: true, provider: browserProvider, instances: [{ browser: 'chromium' }] },
        },
      },
    ],
  },
})
