import { defineConfig } from '@playwright/test'
import { E2E_ADMIN_PASSWORD } from './e2e/fixtures'

/**
 * On-demand happy-path e2e suite — `npm run e2e` / `make e2e`. Not part of
 * `npm test` or CI.
 *
 * Starts its own backend (port 8100, fresh temp DB + picture folder, test
 * admin password, no OpenAI key) and its own Vite dev server (port 5174)
 * proxying to it, so it never touches the real database or the dev servers
 * on 8000/5173. `reuseExistingServer: false` means a run fails rather than
 * silently testing whatever else is already on those ports.
 *
 * Uses the locally installed Google Chrome (`channel: 'chrome'`), so there's
 * no Playwright browser download.
 */

const BACKEND_PORT = 8100
const FRONTEND_PORT = 5174

export default defineConfig({
  testDir: './e2e',
  // One shared temp DB per run; tests use unique names but run one at a
  // time so screenshots and admin deletes never race each other.
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'e2e-report' }]],
  outputDir: 'e2e-results',
  use: {
    baseURL: `http://127.0.0.1:${FRONTEND_PORT}`,
    channel: 'chrome',
    viewport: { width: 1280, height: 900 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: 'sh e2e/start-backend.sh',
      url: `http://127.0.0.1:${BACKEND_PORT}/api/profiles`,
      reuseExistingServer: false,
      timeout: 60_000,
      stdout: 'pipe',
      env: {
        E2E_BACKEND_PORT: String(BACKEND_PORT),
        ADMIN_PASSWORD: E2E_ADMIN_PASSWORD,
        // Set (even empty) so backend/.env can't fill them in: no real
        // OpenAI calls, and no local seed profile with a real kid's name.
        OPENAI_API_KEY: '',
        IMAGE_PROVIDER: 'none',
        LOCAL_SEED_PROFILE_NAME: '',
      },
    },
    {
      command: `npx vite --port ${FRONTEND_PORT} --strictPort --host 127.0.0.1`,
      url: `http://127.0.0.1:${FRONTEND_PORT}`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: { API_PROXY_TARGET: `http://127.0.0.1:${BACKEND_PORT}` },
    },
  ],
})
