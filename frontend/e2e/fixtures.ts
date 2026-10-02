import { test as base, expect, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

/** Test-only admin password for the e2e backend (see playwright.config.ts).
 * Never the real one in backend/.env. */
export const E2E_ADMIN_PASSWORD = 'e2e-admin-password'

/** Where `snap` saves the key-screen screenshots reviewed after a run. */
export const SCREENS_DIR = path.join(import.meta.dirname, '..', 'e2e-screens')

// Two 16x16 solid-color PNGs — stand-ins for saved profile pictures, so the
// picture tests need neither a camera nor OpenAI.
export const PURPLE_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAFklEQVR4nGNocDhBEmIY1TCqYfhqAAAeOIgQU/XM0wAAAABJRU5ErkJggg=='
export const ORANGE_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAFklEQVR4nGP4ME2DJMQwqmFUw/DVAABhra4QkVwVZAAAAABJRU5ErkJggg=='

/** A name no other test in this run will use (the temp DB is shared). */
export function uniqueName(base: string): string {
  return `${base} ${Math.random().toString(36).slice(2, 6)}`
}

/** Full-page screenshot of a key screen, for the post-run visual review. */
export async function snap(page: Page, name: string): Promise<void> {
  // Let images finish (or fail over to their initial-letter fallback) so a
  // screenshot never catches a half-loaded avatar.
  await page.waitForLoadState('networkidle')
  fs.mkdirSync(SCREENS_DIR, { recursive: true })
  await page.screenshot({ path: path.join(SCREENS_DIR, `${name}.png`), fullPage: true })
}

/** Fails the test on any uncaught page error or console.error. Missing
 * animal-avatar art 404s by design (ProfileAvatar falls back to the
 * initial), so failed resource loads are ignored. */
export const test = base.extend<{ pageErrors: string[] }>({
  pageErrors: [
    async ({ page }, use) => {
      const errors: string[] = []
      page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`))
      page.on('console', (msg) => {
        if (msg.type() === 'error' && !msg.text().startsWith('Failed to load resource')) errors.push(`console.error: ${msg.text()}`)
      })
      await use(errors)
      expect(errors, 'no JS errors on the page').toEqual([])
    },
    { auto: true },
  ],
})

export { expect }

export async function openPicker(page: Page): Promise<void> {
  await page.goto('/')
  await expect(page.getByText("Who's playing?")).toBeVisible()
}

/** Fills the create-profile form and submits; lands on the game picker. */
export async function createProfile(page: Page, opts: { name: string; avatar?: string; password?: string }): Promise<void> {
  await openPicker(page)
  await page.getByRole('button', { name: 'Add a player' }).click()
  await page.getByPlaceholder('What should we call them?').fill(opts.name)
  await page.getByLabel('Birthday').fill('2018-05-12')
  await page.getByRole('button', { name: `Choose the ${opts.avatar ?? 'cat'} avatar` }).click()
  if (opts.password) {
    await page.getByLabel('Password', { exact: true }).fill(opts.password)
    await page.getByLabel('Type the password again').fill(opts.password)
  }
  await page.getByRole('button', { name: 'Create profile' }).click()
  await expectGamePicker(page, opts.name)
}

export async function expectGamePicker(page: Page, name: string): Promise<void> {
  await expect(page.getByText('Pick a game')).toBeVisible()
  await expect(page.getByText(`Hi ${name}`)).toBeVisible()
}

export async function switchPlayer(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Switch player' }).click()
  await expect(page.getByText("Who's playing?")).toBeVisible()
}

export function playButton(page: Page, name: string) {
  return page.getByRole('button', { name: new RegExp(`^Play as ${escapeRegExp(name)}`) })
}

/** On the unlock screen: type a password and press Let's go. */
export async function enterPassword(page: Page, password: string): Promise<void> {
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: "Let's go" }).click()
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
