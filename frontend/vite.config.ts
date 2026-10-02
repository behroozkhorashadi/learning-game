import { readFileSync, writeFileSync } from 'node:fs'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// The e2e suite (playwright.config.ts) points a second dev server at its own
// throwaway backend via API_PROXY_TARGET; everything else uses the real one.
const apiTarget = process.env.API_PROXY_TARGET ?? 'http://127.0.0.1:8000'

const HIT_LAB_FIXTURE = new URL('./e2e/fixtures/zombie-hit-lab-shots.json', import.meta.url)
const OUTCOMES = ['head', 'body', 'miss']

interface HitLabShot {
  id: string
  characterId: string
  lane: number
  distance: number
  poseTime: number
  ndc: { x: number; y: number }
  expected: string
  recorded: string
}

function isHitLabShot(value: unknown): value is HitLabShot {
  const s = value as HitLabShot
  return (
    typeof s === 'object' &&
    s !== null &&
    typeof s.id === 'string' &&
    typeof s.characterId === 'string' &&
    Number.isInteger(s.lane) &&
    [s.distance, s.poseTime, s.ndc?.x, s.ndc?.y].every((n) => typeof n === 'number' && Number.isFinite(n)) &&
    OUTCOMES.includes(s.expected) &&
    OUTCOMES.includes(s.recorded)
  )
}

/**
 * Dev-server-only endpoint behind the hit lab's "Save to test set" button
 * (`src/dev/ZombieHitLab.tsx`): merges labeled shots into the Playwright
 * eval's fixture, skipping ids already there so saving twice is harmless.
 * Only ever writes that one file, and only well-formed shots.
 */
function hitLabFixturePlugin(): Plugin {
  return {
    name: 'hit-lab-fixture',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__hit-lab/append', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end()
          return
        }
        let body = ''
        req.on('data', (chunk) => (body += chunk))
        req.on('end', () => {
          try {
            const incoming = (JSON.parse(body) as { shots: unknown[] }).shots
            if (!Array.isArray(incoming) || !incoming.every(isHitLabShot)) throw new Error('malformed shots')
            const fixture = JSON.parse(readFileSync(HIT_LAB_FIXTURE, 'utf8')) as { shots: HitLabShot[] }
            const known = new Set(fixture.shots.map((s) => s.id))
            const added = incoming
              .filter((s) => !known.has(s.id))
              .map(({ id, characterId, lane, distance, poseTime, ndc, expected, recorded }) => ({ characterId, lane, distance, poseTime, id, ndc: { x: ndc.x, y: ndc.y }, expected, recorded }))
            if (added.length) {
              fixture.shots.push(...added)
              writeFileSync(HIT_LAB_FIXTURE, JSON.stringify(fixture, null, 2) + '\n')
            }
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ added: added.length, total: fixture.shots.length }))
          } catch (err) {
            res.statusCode = 400
            res.end(String(err))
          }
        })
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), hitLabFixturePlugin()],
  server: {
    host: '0.0.0.0', // LAN-reachable, per PRD §9
    proxy: {
      '/api': apiTarget,
      '/static': apiTarget,
    },
  },
})
