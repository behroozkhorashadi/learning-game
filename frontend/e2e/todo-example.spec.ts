import { test, expect, snap } from './fixtures.ts'

/**
 * Smoke test that the major systems connect: the worked example, assembled for
 * real (localStorage, fetch, flags), backs up through the Vite proxy to the real
 * FastAPI route and SQLite. Everything finer-grained is covered by unit tests
 * and stories with fakes.
 */
test('worked example: add a todo, back it up, and the backend has it', async ({ page }) => {
  await page.goto('/?screen=todo-example&flags=examples_todo_backup')

  await page.getByRole('textbox', { name: 'New todo' }).fill('Feed the cat')
  await page.getByRole('button', { name: 'Add' }).click()
  await expect(page.getByRole('checkbox', { name: 'Feed the cat' })).toBeVisible()

  await page.getByRole('button', { name: 'Back up to server' }).click()
  await expect(page.getByText('Backed up 1 todo')).toBeVisible()
  await snap(page, '20-todo-example-backed-up')

  const response = await page.request.get('/api/examples/todos')
  expect(response.ok()).toBe(true)
  expect(await response.json()).toEqual([expect.objectContaining({ title: 'Feed the cat', done: false })])
})
