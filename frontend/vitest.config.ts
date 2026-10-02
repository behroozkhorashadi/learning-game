import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    // Playwright e2e specs run on demand via `npm run e2e`, never here/CI.
    exclude: ['**/node_modules/**', 'e2e/**'],
  },
})
