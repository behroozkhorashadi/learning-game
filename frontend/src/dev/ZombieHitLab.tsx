import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { Canvas, advance, useThree } from '@react-three/fiber'
import { EquationOutbreakScene } from '../components/EquationOutbreakScene'
import { ZOMBIE_CHARACTER_REGISTRY } from '../lib/characterDefinitions'
import { STARTER_BLASTER } from '../lib/weaponDefinitions'
import { classifyIntersections } from '../components/EnvironmentCollider'
import { resolveRaycastOutcome } from '../lib/raycastOutcome'
import type { Carrier } from '../lib/zombieWaveEngine'

/**
 * Dev-only hit-detection lab (`?screen=zombie-hit-lab`): the real Equation
 * Outbreak scene (same camera, lanes, environment colliders and zombie
 * hit testing) with a single frozen zombie. You shoot, the lab shows what the
 * game's hit logic decided, and you label what it *should* have been
 * (H = head, B = body, M = miss). Labeled shots persist in localStorage;
 * "Save to test set" merges them into the Playwright eval's fixture
 * (`e2e/fixtures/zombie-hit-lab-shots.json`, via a dev-server endpoint in
 * `vite.config.ts`); "Re-score" replays every saved shot against whatever hit
 * logic is current, so a hitbox change can be measured against the labels.
 *
 * The canvas is pinned to 16:9 so a shot's NDC maps to the same world ray
 * on every replay regardless of window size (lane layout and FOV both
 * depend on aspect ratio).
 */

type Outcome = 'head' | 'body' | 'miss'

interface LabConfig {
  characterId: string
  lane: number
  distance: number
  poseTime: number
}

interface LabShot extends LabConfig {
  id: string
  ndc: { x: number; y: number }
  expected: Outcome | null
  /** What the hit logic said when the shot was taken. */
  recorded: Outcome
  /** What the hit logic says after the latest Re-score (if run). */
  rescored?: Outcome
  /** What the game's own R3F pointer handlers reported for the live click
   * — should always equal `recorded`; a difference means the lab's replay
   * raycast has drifted from the real event path. */
  live?: Outcome
}

const STORAGE_KEY = 'zombieHitLab.shots.v1'

/** Starting setup, optionally from the URL (`&character=&lane=&distance=&pose=`)
 * so the Playwright eval can open each labeled setup directly. */
function initialConfig(): LabConfig {
  const params = new URLSearchParams(window.location.search)
  const num = (key: string, fallback: number) => (params.has(key) ? Number(params.get(key)) : fallback)
  return {
    characterId: params.get('character') ?? ZOMBIE_CHARACTER_REGISTRY[0].id,
    lane: num('lane', 1),
    distance: num('distance', 0.5),
    poseTime: num('pose', 0.5),
  }
}
const ASPECT = 16 / 9
const CARRIER_ID = 'lab-zombie'

function loadShots(): LabShot[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as LabShot[]) : []
  } catch {
    return []
  }
}

function saveShots(shots: LabShot[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(shots))
  } catch {
    // private window / blocked storage — export still works
  }
}

function sameConfig(a: LabConfig, b: LabConfig) {
  return a.characterId === b.characterId && a.lane === b.lane && a.distance === b.distance && a.poseTime === b.poseTime
}

function currentOutcome(shot: LabShot): Outcome {
  return shot.rescored ?? shot.recorded
}

const isHit = (o: Outcome) => o !== 'miss'

type ShootFn = (ndc: { x: number; y: number }) => Outcome

/**
 * Mirrors the game's pointer path without going through R3F's event
 * dispatch: cast the camera ray and classify the hits with the same
 * `classifyIntersections` + `resolveRaycastOutcome` the game's handlers use.
 */
function Shooter({ shootRef, hasZombieRef }: { shootRef: React.MutableRefObject<ShootFn | null>; hasZombieRef: React.MutableRefObject<() => boolean> }) {
  const { camera, scene } = useThree()
  const raycaster = useMemo(() => new THREE.Raycaster(), [])
  useEffect(() => {
    shootRef.current = (ndc) => {
      raycaster.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), camera)
      const outcome = resolveRaycastOutcome(classifyIntersections(raycaster.intersectObjects(scene.children, true)))
      return outcome.type === 'zombie' && outcome.meta ? outcome.meta.zone : 'miss'
    }
    hasZombieRef.current = () => {
      let found = false
      scene.traverse((obj) => {
        if (obj.userData.raycastKind === 'zombie') found = true
      })
      return found
    }
    return () => {
      shootRef.current = null
    }
  }, [camera, scene, raycaster, shootRef, hasZombieRef])
  return null
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/**
 * Waits until the scene shows a hittable zombie for the new setup, stepping
 * the render loop by hand (`advance`) so the pinned pose is applied even in
 * a background tab, where requestAnimationFrame doesn't fire.
 */
async function settleScene(hasZombie: () => boolean) {
  let steadyTicks = 0
  for (let i = 0; i < 200 && steadyTicks < 8; i++) {
    await sleep(25)
    advance(performance.now())
    steadyTicks = hasZombie() ? steadyTicks + 1 : 0
  }
}

const OUTCOME_COLOR: Record<Outcome, string> = { head: '#FF2D55', body: '#2D9CFF', miss: '#9AA0A6' }

export function ZombieHitLab() {
  const [config, setConfig] = useState<LabConfig>(initialConfig)
  const [saveStatus, setSaveStatus] = useState<string | null>(null)
  const [shots, setShots] = useState<LabShot[]>(loadShots)
  const [aimNdc, setAimNdc] = useState<{ x: number; y: number } | null>(null)
  const [recoilSignal, setRecoilSignal] = useState(0)
  const [rescoring, setRescoring] = useState(false)
  const shootRef = useRef<ShootFn | null>(null)
  const hasZombieRef = useRef<() => boolean>(() => false)
  const liveHitRef = useRef<Outcome | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => saveShots(shots), [shots])

  const character = ZOMBIE_CHARACTER_REGISTRY.find((c) => c.id === config.characterId) ?? ZOMBIE_CHARACTER_REGISTRY[0]
  const charactersByLane = [character, character, character, character]
  const carrier: Carrier = {
    // Keyed on pose so a pose change remounts the zombie and re-seeks its clip.
    id: `${CARRIER_ID}-${config.poseTime}`,
    label: '?',
    correct: true,
    lane: config.lane,
    distance: config.distance,
    status: 'active',
    defeatedBy: null,
  }

  const pending = shots.find((s) => s.expected === null) ?? null
  const shotsHere = shots.filter((s) => sameConfig(s, config))

  function label(expected: Outcome) {
    if (!pending) return
    setShots((prev) => prev.map((s) => (s.id === pending.id ? { ...s, expected } : s)))
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const key = e.key.toLowerCase()
      if (key === 'h') label('head')
      else if (key === 'b') label('body')
      else if (key === 'm') label('miss')
      else if (key === 'backspace' || key === 'z') setShots((prev) => prev.slice(0, -1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  function toNdc(e: React.PointerEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    return { x: ((e.clientX - rect.left) / rect.width) * 2 - 1, y: -(((e.clientY - rect.top) / rect.height) * 2 - 1) }
  }

  function handleShoot(e: React.PointerEvent<HTMLDivElement>) {
    if (e.button !== 0 || !shootRef.current) return
    const ndc = toNdc(e)
    const recorded = shootRef.current(ndc)
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    setRecoilSignal((n) => n + 1)
    setShots((prev) => [
      // An unlabeled previous shot is dropped — every saved shot carries a label.
      ...prev.filter((s) => s.expected !== null),
      { ...config, id, ndc, expected: null, recorded },
    ])
    // R3F dispatches the same pointerdown to the scene's own handlers (its
    // listener sits below this div, so it may run before or after this
    // handler); read what they reported once the event has fully propagated.
    setTimeout(() => {
      const live = liveHitRef.current ?? 'miss'
      liveHitRef.current = null
      if (live !== recorded) console.warn(`[ZombieHitLab] game event path said ${live}, lab raycast said ${recorded}`)
      setShots((prev) => prev.map((s) => (s.id === id ? { ...s, live } : s)))
    }, 0)
  }

  async function rescoreAll() {
    setRescoring(true)
    const original = config
    const configs: LabConfig[] = []
    for (const s of shots) if (!configs.some((c) => sameConfig(c, s))) configs.push({ characterId: s.characterId, lane: s.lane, distance: s.distance, poseTime: s.poseTime })
    const results = new Map<string, Outcome>()
    for (const c of configs) {
      setConfig(c)
      await settleScene(() => hasZombieRef.current())
      for (const s of shots) if (sameConfig(s, c) && shootRef.current) results.set(s.id, shootRef.current(s.ndc))
    }
    setShots((prev) => prev.map((s) => (results.has(s.id) ? { ...s, rescored: results.get(s.id) } : s)))
    setConfig(original)
    setRescoring(false)
  }

  async function saveToTestSet() {
    setSaveStatus('Saving…')
    try {
      const res = await fetch('/__hit-lab/append', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shots: labeled }),
      })
      if (!res.ok) throw new Error(await res.text())
      const { added, total } = (await res.json()) as { added: number; total: number }
      setSaveStatus(`Added ${added} new shot${added === 1 ? '' : 's'} — test set now has ${total}`)
    } catch (err) {
      setSaveStatus(`Save failed: ${String(err)}`)
    }
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify({ version: 1, aspect: ASPECT, shots: shots.filter((s) => s.expected) }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `zombie-hit-lab-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function importJson(file: File) {
    file.text().then((text) => {
      const parsed = JSON.parse(text) as { shots: LabShot[] }
      setShots(parsed.shots)
    })
  }

  // Scoring over labeled shots, against the latest outcome (re-scored if run).
  const labeled = shots.filter((s): s is LabShot & { expected: Outcome } => s.expected !== null)
  const hitMissAgree = labeled.filter((s) => isHit(s.expected) === isHit(currentOutcome(s))).length
  const falseMisses = labeled.filter((s) => isHit(s.expected) && !isHit(currentOutcome(s))).length
  const falseHits = labeled.filter((s) => !isHit(s.expected) && isHit(currentOutcome(s))).length
  const zoneWrong = labeled.filter((s) => isHit(s.expected) && isHit(currentOutcome(s)) && s.expected !== currentOutcome(s)).length
  const pct = (n: number) => (labeled.length ? `${Math.round((n / labeled.length) * 100)}%` : '—')

  const btn: React.CSSProperties = { padding: '5px 9px', fontSize: 12, cursor: 'pointer' }

  return (
    <div style={{ width: '100%', height: '100vh', display: 'flex', flexDirection: 'column', background: '#111', color: '#EEE', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ padding: 8, display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center', fontSize: 12 }}>
        <span style={{ display: 'flex', gap: 4 }}>
          {ZOMBIE_CHARACTER_REGISTRY.filter((c) => c.enabled).map((c) => (
            <button key={c.id} style={{ ...btn, fontWeight: c.id === config.characterId ? 700 : 400 }} onClick={() => setConfig({ ...config, characterId: c.id })}>
              {c.displayName.replace(' Zombie', '')}
            </button>
          ))}
        </span>
        <label>
          Lane{' '}
          <select value={config.lane} onChange={(e) => setConfig({ ...config, lane: Number(e.target.value) })}>
            {[0, 1, 2, 3].map((l) => (
              <option key={l} value={l}>
                {l + 1}
              </option>
            ))}
          </select>
        </label>
        <label>
          Distance {config.distance.toFixed(2)}{' '}
          <input type="range" min={0} max={1} step={0.05} value={config.distance} onChange={(e) => setConfig({ ...config, distance: Number(e.target.value) })} />
        </label>
        <label>
          Pose {config.poseTime.toFixed(2)}s{' '}
          <input type="range" min={0} max={2} step={0.1} value={config.poseTime} onChange={(e) => setConfig({ ...config, poseTime: Number(e.target.value) })} />
        </label>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div
          data-testid="hit-lab-canvas"
          onPointerMove={(e) => setAimNdc(toNdc(e))}
          onPointerLeave={() => setAimNdc(null)}
          onPointerDown={handleShoot}
          style={{ position: 'relative', aspectRatio: `${ASPECT}`, width: `min(100%, calc((100vh - 130px) * ${ASPECT}))`, cursor: 'none', overflow: 'hidden' }}
        >
          <Canvas shadows>
            <Suspense fallback={null}>
              <EquationOutbreakScene
                carriers={[carrier]}
                charactersByLane={charactersByLane}
                weapon={STARTER_BLASTER}
                phase="playing"
                speedMultiplier={0}
                aimNdc={aimNdc}
                reducedMotion
                recoilSignal={recoilSignal}
                weaponPhase="readyFirstShot"
                cockingUntilMs={null}
                elapsedMs={0}
                cockingMs={STARTER_BLASTER.cockingMs}
                onHit={(_carrierId, zone) => {
                  liveHitRef.current = zone
                }}
                onMiss={() => {
                  liveHitRef.current = 'miss'
                }}
                fixedPhaseOffsetSeconds={config.poseTime}
              />
              <Shooter shootRef={shootRef} hasZombieRef={hasZombieRef} />
            </Suspense>
          </Canvas>

          {/* Shot markers for this exact setup: fill = what the game decided,
           * ring = green if it agrees (hit vs. miss) with your label, red if
           * not, white while unlabeled. */}
          {shotsHere.map((s) => {
            const outcome = currentOutcome(s)
            const ring = s.expected === null ? '#FFFFFF' : isHit(s.expected) === isHit(outcome) ? '#22C55E' : '#EF4444'
            return (
              <div
                key={s.id}
                title={`game: ${outcome} / you: ${s.expected ?? '?'}`}
                style={{
                  position: 'absolute',
                  left: `${((s.ndc.x + 1) / 2) * 100}%`,
                  top: `${((1 - s.ndc.y) / 2) * 100}%`,
                  width: 9,
                  height: 9,
                  transform: 'translate(-50%, -50%)',
                  borderRadius: 9999,
                  background: OUTCOME_COLOR[outcome],
                  boxShadow: `0 0 0 2px ${ring}`,
                  pointerEvents: 'none',
                }}
              />
            )
          })}

          {/* Same 36px ring as the game, plus a center dot marking the exact
           * pixel the ray is cast through. */}
          {aimNdc && (
            <div
              style={{
                position: 'absolute',
                left: `${((aimNdc.x + 1) / 2) * 100}%`,
                top: `${((1 - aimNdc.y) / 2) * 100}%`,
                transform: 'translate(-50%, -50%)',
                pointerEvents: 'none',
                width: 36,
                height: 36,
                borderRadius: 9999,
                border: '2.5px solid #FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div style={{ width: 3, height: 3, borderRadius: 9999, background: '#FFFFFF' }} />
            </div>
          )}

          {pending && (
            <div style={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.8)', padding: '8px 12px', borderRadius: 10, fontSize: 14, display: 'flex', gap: 8, alignItems: 'center' }} onPointerDown={(e) => e.stopPropagation()}>
              Game said <b style={{ color: OUTCOME_COLOR[pending.recorded] }}>{pending.recorded.toUpperCase()}</b> — it should be:
              <button style={btn} onClick={() => label('head')}>
                <u>H</u>ead
              </button>
              <button style={btn} onClick={() => label('body')}>
                <u>B</u>ody
              </button>
              <button style={btn} onClick={() => label('miss')}>
                <u>M</u>iss
              </button>
            </div>
          )}
        </div>
      </div>

      <div style={{ padding: 8, display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center', fontSize: 12 }}>
        <span>
          Labeled <b>{labeled.length}</b> · hit/miss agreement <b>{pct(hitMissAgree)}</b> · should-hit-but-missed <b style={{ color: '#EF4444' }}>{falseMisses}</b> · should-miss-but-hit <b>{falseHits}</b> · wrong zone <b>{zoneWrong}</b>
        </span>
        <button style={btn} disabled={rescoring || !shots.length} onClick={rescoreAll}>
          {rescoring ? 'Re-scoring…' : 'Re-score all'}
        </button>
        <button style={btn} onClick={saveToTestSet} disabled={!labeled.length}>
          Save to test set
        </button>
        {saveStatus && <span>{saveStatus}</span>}
        <button style={btn} onClick={exportJson} disabled={!labeled.length}>
          Download JSON
        </button>
        <button style={btn} onClick={() => fileInputRef.current?.click()}>
          Import JSON
        </button>
        <input ref={fileInputRef} type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && importJson(e.target.files[0])} />
        <button style={btn} onClick={() => setShots((prev) => prev.slice(0, -1))} disabled={!shots.length}>
          Undo (Z)
        </button>
        <button style={btn} onClick={() => setShots([])} disabled={!shots.length}>
          Clear all
        </button>
      </div>
    </div>
  )
}
