import {
  test,
  expect,
  createProfile,
  switchPlayer,
  playButton,
  enterPassword,
  expectGamePicker,
  snap,
  uniqueName,
  E2E_ADMIN_PASSWORD,
} from './fixtures'

test('a password-protected profile asks for its password, and rejects a wrong one', async ({ page }) => {
  const name = uniqueName('Maya')
  await createProfile(page, { name, password: 'tiger42' })
  await switchPlayer(page)

  await expect(page.getByRole('button', { name: `Play as ${name} (needs a password)` })).toBeVisible()
  await snap(page, '10-picker-with-lock')

  await playButton(page, name).click()
  await expect(page.getByText(`Hi ${name}!`)).toBeVisible()
  await snap(page, '11-unlock-screen')

  await enterPassword(page, 'wrong-one')
  await expect(page.getByText("That's not it. Try again!")).toBeVisible()
  await snap(page, '12-unlock-wrong-password')

  await enterPassword(page, 'tiger42')
  await expectGamePicker(page, name)
})

test('change your password: the old one stops working, the new one works', async ({ page }) => {
  const name = uniqueName('Omar')
  await createProfile(page, { name, password: 'tiger42' })

  // Just created with a password, so Edit profile shouldn't ask for it again.
  await page.getByRole('button', { name: 'Edit profile' }).click()
  await expect(page.getByText(`Edit ${name}`)).toBeVisible()
  await page.getByLabel('New password').fill('lion99')
  await page.getByLabel('Type the password again').fill('lion99')
  await snap(page, '13-change-password')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expectGamePicker(page, name)

  // And the session now holds the new password: editing again still works.
  await page.getByRole('button', { name: 'Edit profile' }).click()
  await page.getByRole('button', { name: 'Choose the owl avatar' }).click()
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expectGamePicker(page, name)

  await switchPlayer(page)
  await playButton(page, name).click()
  await enterPassword(page, 'tiger42')
  await expect(page.getByText("That's not it. Try again!")).toBeVisible()
  await enterPassword(page, 'lion99')
  await expectGamePicker(page, name)
})

test('forgot password: the admin password unlocks it and can remove the password', async ({ page }) => {
  const name = uniqueName('Zoe')
  await createProfile(page, { name, password: 'tiger42' })
  await switchPlayer(page)

  await page.getByRole('button', { name: `Edit ${name}` }).click()
  await expect(page.getByText(`Hi ${name}!`)).toBeVisible()
  await enterPassword(page, E2E_ADMIN_PASSWORD)

  await expect(page.getByText(`Edit ${name}`)).toBeVisible()
  await page.getByLabel(/Remove the password/).check()
  await page.getByRole('button', { name: 'Save changes' }).click()

  await expect(page.getByRole('button', { name: `Play as ${name}`, exact: true })).toBeVisible()
  await playButton(page, name).click()
  await expectGamePicker(page, name)
})

test('add a password to an existing open profile', async ({ page }) => {
  const name = uniqueName('Ben')
  await createProfile(page, { name })

  await page.getByRole('button', { name: 'Edit profile' }).click()
  await page.getByLabel('Password', { exact: true }).fill('tiger42')
  await page.getByLabel('Type the password again').fill('tiger4')
  await expect(page.getByText("The two passwords don't match yet.")).toBeVisible()
  await page.getByLabel('Type the password again').fill('tiger42')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expectGamePicker(page, name)

  await switchPlayer(page)
  await expect(page.getByRole('button', { name: `Play as ${name} (needs a password)` })).toBeVisible()
})
