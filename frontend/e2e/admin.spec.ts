import { test, expect, openPicker, createProfile, switchPlayer, playButton, snap, uniqueName, E2E_ADMIN_PASSWORD } from './fixtures'

test('admin screen: wrong password is refused, right one lists players and can remove one', async ({ page }) => {
  const name = uniqueName('Remove Me')
  await createProfile(page, { name })
  await switchPlayer(page)

  await page.getByRole('button', { name: 'Admin' }).click()
  await page.getByPlaceholder('Password').fill('not-the-admin-password')
  await page.getByRole('button', { name: 'Enter' }).click()
  await expect(page.getByText('Incorrect password.')).toBeVisible()

  await page.getByPlaceholder('Password').fill(E2E_ADMIN_PASSWORD)
  await page.getByRole('button', { name: 'Enter' }).click()
  await expect(page.getByText('Players')).toBeVisible()
  await snap(page, '30-admin-players')

  const row = page.locator('div', { has: page.getByText(name, { exact: true }) }).filter({ has: page.getByRole('button', { name: 'Delete' }) }).last()
  await row.getByRole('button', { name: 'Delete' }).click()
  await row.getByRole('button', { name: 'Yes, remove' }).click()
  await expect(page.getByText(name, { exact: true })).toHaveCount(0)

  await page.getByRole('button', { name: 'Back' }).click()
  await openPicker(page)
  await expect(playButton(page, name)).toHaveCount(0)
})
