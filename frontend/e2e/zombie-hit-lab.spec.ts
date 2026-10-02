import { readFileSync } from 'node:fs'
import { test, expect } from '@playwright/test'

/**
 * Equation Outbreak hit-detection eval. Replays hand-labeled shots
 * (`fixtures/zombie-hit-lab-shots.json`, recorded and labeled in the dev hit
 * lab at `?screen=zombie-hit-lab` and added with its "Save to test set" button)
 * against the current hit logic, and fails if agreement with the labels
 * drops below the bars below. Needs real WebGL and the real zombie GLBs,
 * which is why it lives here rather than in vitest.
 *
 * To grow the set: label more shots in the lab and click "Save to test set"
 * (appends, skipping shots already saved).
 */

type Outcome = 'head' | 'body' | 'miss'
interface Shot {
  id: string
  characterId: string
  lane: number
  distance: number
  poseTime: number
  expected: Outcome
  recorded: Outcome
  rescored?: Outcome
  ndc: { x: number; y: number }
}

const fixture = JSON.parse(readFileSync(new URL('./fixtures/zombie-hit-lab-shots.json', import.meta.url), 'utf8')) as { shots: Shot[] }

// Hit vs. miss is what a kid notices ("I hit it and nothing happened");
// head vs. body only changes the death animation, so it gets a looser bar.
const MIN_HIT_MISS_AGREEMENT = 0.9
const MIN_ZONE_AGREEMENT = 0.75

test('zombie hit detection agrees with hand-labeled shots', async ({ page }) => {
  test.setTimeout(120_000)
  await page.addInitScript((shots) => {
    window.localStorage.setItem('zombieHitLab.shots.v1', JSON.stringify(shots))
  }, fixture.shots)
  await page.goto('/?screen=zombie-hit-lab')

  await page.getByRole('button', { name: 'Re-score all' }).click()
  await expect(page.getByRole('button', { name: 'Re-score all' })).toBeEnabled({ timeout: 90_000 })

  const shots = await page.evaluate(() => JSON.parse(window.localStorage.getItem('zombieHitLab.shots.v1') ?? '[]') as Shot[])
  expect(shots.every((s) => s.rescored)).toBe(true)

  const isHit = (o: Outcome) => o !== 'miss'
  const hitMiss = shots.filter((s) => isHit(s.expected) === isHit(s.rescored!)).length / shots.length
  const zone = shots.filter((s) => s.expected === s.rescored).length / shots.length
  const before = shots.filter((s) => isHit(s.expected) === isHit(s.recorded)).length / shots.length

  console.log(`hit/miss agreement ${(hitMiss * 100).toFixed(0)}% (was ${(before * 100).toFixed(0)}% when labeled), exact zone ${(zone * 100).toFixed(0)}%`)
  for (const s of shots.filter((s) => s.expected !== s.rescored)) {
    console.log(`  mismatch: ndc (${s.ndc.x.toFixed(3)}, ${s.ndc.y.toFixed(3)}) expected ${s.expected}, got ${s.rescored}`)
  }
  await page.screenshot({ path: 'e2e-results/zombie-hit-lab.png' })

  expect(hitMiss).toBeGreaterThanOrEqual(MIN_HIT_MISS_AGREEMENT)
  expect(zone).toBeGreaterThanOrEqual(MIN_ZONE_AGREEMENT)
})

test('real clicks go through the game\'s own event path and agree with the lab raycast', async ({ page }) => {
  test.setTimeout(300_000)
  // Every navigation starts the lab with no saved shots, so each setup's
  // clicks are read back on their own.
  await page.addInitScript(() => window.localStorage.removeItem('zombieHitLab.shots.v1'))

  const setups = new Map<string, Shot[]>()
  for (const shot of fixture.shots) {
    const key = `character=${shot.characterId}&lane=${shot.lane}&distance=${shot.distance}&pose=${shot.poseTime}`
    setups.set(key, [...(setups.get(key) ?? []), shot])
  }

  let landed = 0
  for (const [query, expectedShots] of setups) {
    await page.goto(`/?screen=zombie-hit-lab&${query}`)
    const canvas = page.getByTestId('hit-lab-canvas')
    await expect(canvas.locator('canvas')).toBeVisible()
    // Give the zombie GLB time to load and pose.
    await page.waitForTimeout(3000)
    const box = (await canvas.boundingBox())!

    for (const shot of expectedShots) {
      await page.mouse.click(box.x + ((shot.ndc.x + 1) / 2) * box.width, box.y + ((1 - shot.ndc.y) / 2) * box.height)
      await page.keyboard.press('m') // label it so the next click starts a new shot
    }
    await page.waitForTimeout(200)

    const shots = await page.evaluate(() => JSON.parse(window.localStorage.getItem('zombieHitLab.shots.v1') ?? '[]') as Shot[])
    expect(shots, query).toHaveLength(expectedShots.length)
    for (const s of shots) expect(s.live, `${query}: click at (${s.ndc.x.toFixed(3)}, ${s.ndc.y.toFixed(3)})`).toBe(s.recorded)
    landed += shots.filter((s) => s.live !== 'miss').length
  }
  // Sanity: the clicks actually hit something, so this isn't vacuously "miss === miss".
  expect(landed).toBeGreaterThan(fixture.shots.length / 2)
})
