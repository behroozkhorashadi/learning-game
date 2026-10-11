import { readFileSync } from 'node:fs'
import { test, expect, type Page } from '@playwright/test'

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
  readonly id: string
  readonly characterId: string
  readonly lane: number
  readonly distance: number
  readonly poseTime: number
  readonly expected: Outcome
  readonly recorded: Outcome
  readonly rescored?: Outcome
  readonly live?: Outcome
  readonly ndc: { readonly x: number; readonly y: number }
}

// The fixture is ours (written by the lab's "Save to test set"), checked into the repo. Cast confined to this test.
const fixture = JSON.parse(readFileSync(new URL('./fixtures/zombie-hit-lab-shots.json', import.meta.url), 'utf8')) as { readonly shots: readonly Shot[] }

/** The lab's saved shots, read back from the page. */
async function savedShots(page: Page): Promise<readonly Shot[]> {
  // The lab wrote these itself (zod-checked on its side). Cast confined to this test.
  return page.evaluate(() => JSON.parse(window.localStorage.getItem('zombieHitLab.shots.v1') ?? '[]') as Shot[])
}

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

  const shots = await savedShots(page)
  expect(shots.every((s) => s.rescored !== undefined)).toBe(true)

  const isHit = (o: Outcome): boolean => o !== 'miss'
  const rescored = (s: Shot): Outcome => s.rescored ?? s.recorded
  const hitMiss = shots.filter((s) => isHit(s.expected) === isHit(rescored(s))).length / shots.length
  const zone = shots.filter((s) => s.expected === rescored(s)).length / shots.length
  const before = shots.filter((s) => isHit(s.expected) === isHit(s.recorded)).length / shots.length

  console.log(`hit/miss agreement ${(hitMiss * 100).toFixed(0)}% (was ${(before * 100).toFixed(0)}% when labeled), exact zone ${(zone * 100).toFixed(0)}%`)
  for (const s of shots.filter((s) => s.expected !== rescored(s))) {
    console.log(`  mismatch: ndc (${s.ndc.x.toFixed(3)}, ${s.ndc.y.toFixed(3)}) expected ${s.expected}, got ${rescored(s)}`)
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
    const key = `character=${shot.characterId}&lane=${String(shot.lane)}&distance=${String(shot.distance)}&pose=${String(shot.poseTime)}`
    setups.set(key, [...(setups.get(key) ?? []), shot])
  }

  let landed = 0
  for (const [query, expectedShots] of setups) {
    await page.goto(`/?screen=zombie-hit-lab&${query}`)
    const range = page.getByRole('region', { name: 'Shooting range' })
    // The lab marks itself ready once this setup's zombie has loaded, posed, and been a hit target for several frames in a row.
    await expect(range).toHaveAttribute('data-zombie-ready', 'true', { timeout: 30_000 })
    const box = await range.boundingBox()
    if (box === null) throw new Error('the shooting range has no box')

    for (const shot of expectedShots) {
      await page.mouse.click(box.x + ((shot.ndc.x + 1) / 2) * box.width, box.y + ((1 - shot.ndc.y) / 2) * box.height)
      await page.keyboard.press('m') // label it so the next click starts a new shot
    }
    // Every shot is saved once the game's own event path has reported on it too.
    await expect.poll(async () => (await savedShots(page)).filter((s) => s.live !== undefined).length, { message: query }).toBe(expectedShots.length)

    const shots = await savedShots(page)
    expect(shots, query).toHaveLength(expectedShots.length)
    for (const s of shots) expect(s.live, `${query}: click at (${s.ndc.x.toFixed(3)}, ${s.ndc.y.toFixed(3)})`).toBe(s.recorded)
    landed += shots.filter((s) => s.live !== 'miss').length
  }
  // Sanity: the clicks actually hit something, so this isn't vacuously "miss === miss".
  expect(landed).toBeGreaterThan(fixture.shots.length / 2)
})
