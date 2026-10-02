import { test, expect, openPicker, playButton, snap, uniqueName, PURPLE_PNG, ORANGE_PNG } from './fixtures'
import type { APIRequestContext } from '@playwright/test'

// Saved pictures are seeded through the API (two tiny PNGs), so this needs
// neither a camera nor OpenAI — it checks switching and deleting in the UI.
async function seedProfileWithPictures(request: APIRequestContext, name: string) {
  const res = await request.post('/api/profiles', {
    data: {
      name,
      avatar: 'fox',
      birth_year: 2018,
      new_photos: [
        { image_data_url: PURPLE_PNG, label: 'Photo', use_as_avatar: true },
        { image_data_url: ORANGE_PNG, label: 'Wizard' },
        { image_data_url: PURPLE_PNG, label: 'Pixel art' },
      ],
    },
  })
  expect(res.ok()).toBeTruthy()
  return res.json() as Promise<{ id: number; avatar: string }>
}

async function avatarSrc(page: import('@playwright/test').Page, name: string) {
  return playButton(page, name).locator('img').getAttribute('src')
}

test('switch between saved pictures and delete one', async ({ page, request }) => {
  const name = uniqueName('Kai')
  const profile = await seedProfileWithPictures(request, name)
  const photos: { id: number; url: string; label: string }[] = await (await request.get(`/api/profiles/${profile.id}/photos`)).json()
  const wizard = photos.find((p) => p.label === 'Wizard')!

  await openPicker(page)
  expect(await avatarSrc(page, name)).toBe(profile.avatar)

  await page.getByRole('button', { name: `Edit ${name}` }).click()
  await expect(page.getByText('Your pictures')).toBeVisible()
  await expect(page.getByRole('button', { name: /^Use / })).toHaveCount(3)
  // The current picture can't be deleted; the others can.
  await expect(page.getByRole('button', { name: 'Delete Photo' })).toHaveCount(0)
  await snap(page, '20-saved-pictures')

  await page.getByRole('button', { name: 'Use Wizard' }).click()
  await page.getByRole('button', { name: 'Delete Pixel art' }).click()
  await page.getByRole('button', { name: 'Really delete Pixel art?' }).click()
  await expect(page.getByRole('button', { name: 'Use Pixel art' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Save changes' }).click()

  await expect(playButton(page, name)).toBeVisible()
  expect(await avatarSrc(page, name)).toBe(wizard.url)
  await snap(page, '21-picker-after-switching-picture')

  // Switching back is still possible — the original wasn't deleted.
  await page.getByRole('button', { name: `Edit ${name}` }).click()
  await page.getByRole('button', { name: 'Use Photo' }).click()
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(playButton(page, name)).toBeVisible()
  expect(await avatarSrc(page, name)).toBe(profile.avatar)
})

test('remix panel offers looks but never calls OpenAI in e2e mode', async ({ request }) => {
  // The e2e backend runs with no OpenAI key, so a remix is refused quickly
  // instead of spending a minute (and money) on a real image.
  const res = await request.post('/api/profile-photos/remix', { data: { image_data_url: PURPLE_PNG, style: 'cartoon' } })
  expect(res.status()).toBe(503)
})
