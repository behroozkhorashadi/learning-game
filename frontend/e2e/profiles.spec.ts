import { test, expect, openPicker, createProfile, switchPlayer, playButton, expectGamePicker, snap, uniqueName } from './fixtures.ts'

// The seeded "Demo Kid" only exists until a real profile does (backend
// tests/test_demo_profile.py), and this suite shares one database, so every
// test brings its own player rather than relying on the demo.
test('profile picker lists each player with play and edit buttons, plus Add a player', async ({ page }) => {
  const name = uniqueName('Pia')
  await createProfile(page, { name })
  await switchPlayer(page)

  await expect(playButton(page, name)).toBeVisible()
  await expect(page.getByRole('button', { name: `Edit ${name}` })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Add a player' })).toBeVisible()
  await snap(page, '01-profile-picker')
})

test('create a profile with an animal avatar, then pick it again', async ({ page }) => {
  const name = uniqueName('Nora')

  await openPicker(page)
  await page.getByRole('button', { name: 'Add a player' }).click()
  await expect(page.getByText('Add a player')).toBeVisible()
  await snap(page, '02-create-profile-form')

  await createProfile(page, { name, avatar: 'owl' })
  await snap(page, '03-game-picker')

  await switchPlayer(page)
  await playButton(page, name).click()
  await expectGamePicker(page, name)
})

test('edit a profile from the picker pencil: rename and change animal', async ({ page }) => {
  const name = uniqueName('Sam')
  const renamed = uniqueName('Samira')
  await createProfile(page, { name, avatar: 'fox' })
  await switchPlayer(page)

  await page.getByRole('button', { name: `Edit ${name}` }).click()
  await expect(page.getByText(`Edit ${name}`)).toBeVisible()
  await snap(page, '04-edit-profile')

  await page.getByLabel('Name', { exact: true }).fill(renamed)
  await page.getByRole('button', { name: 'Choose the panda avatar' }).click()
  await page.getByRole('button', { name: 'Save changes' }).click()

  await expect(playButton(page, renamed)).toBeVisible()
  await expect(playButton(page, name)).toHaveCount(0)
})

test('edit a profile from the game picker returns to the game picker', async ({ page }) => {
  const name = uniqueName('Leo')
  await createProfile(page, { name })

  await page.getByRole('button', { name: 'Edit profile' }).click()
  await page.getByRole('button', { name: 'Choose the bear avatar' }).click()
  await page.getByRole('button', { name: 'Save changes' }).click()

  await expectGamePicker(page, name)
})

test('badges screen opens and goes back', async ({ page }) => {
  const name = uniqueName('Ivy')
  await createProfile(page, { name })

  await page.getByRole('button', { name: 'View badges and prizes' }).click()
  await expect(page.getByText('Pick a game')).toHaveCount(0)
  await snap(page, '05-badges')
  await page.getByRole('button', { name: /back/i }).first().click()

  await expectGamePicker(page, name)
})
