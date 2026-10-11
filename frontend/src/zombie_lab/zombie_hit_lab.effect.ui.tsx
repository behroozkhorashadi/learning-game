import { Canvas, advance } from '@react-three/fiber'
import { useRef, useState, type ComponentType, type CSSProperties, type PointerEvent, type ReactElement } from 'react'
import { aimFromPointer } from '@app/outbreak/arena_session.pure.lib.ts'
import { OutbreakScene } from '@app/arena/outbreak_scene.pure.ui.tsx'
import { STARTER_BLASTER } from '@app/blaster/weapon_definitions.pure.lib.ts'
import { AsyncBoundary } from '@app/boundary/async_boundary.pure.ui.tsx'
import { errorMessage } from '@app/query/query_state.pure.lib.ts'
import { SCIENTIST_ZOMBIE, ZOMBIE_CHARACTER_REGISTRY } from '@app/zombies/character_definitions.pure.lib.ts'
import type { Carrier } from '@app/zombies/zombie_wave_engine.pure.lib.ts'
import {
  addShot,
  currentOutcome,
  distinctConfigs,
  exportDocument,
  isHit,
  labConfigFromSearch,
  labelPending,
  parseShots,
  percentOf,
  sameConfig,
  scoreShots,
  type AppendResult,
  type LabConfig,
  type LabShot,
  type Outcome,
} from './hit_lab_state.pure.lib.ts'
import { useKeyPresses, type KeyPresses } from './use_key_presses.pure.hook.ts'
import { useLabShooter, SETTLED_FRAMES, type LabShooter } from './use_lab_shooter.pure.hook.ts'
import { useSavedShots, type ShotStorage } from './use_saved_shots.pure.hook.ts'

/**
 * Dev-only hit-detection lab (`?screen=zombie-hit-lab`): the real Equation
 * Outbreak scene (same camera, lanes, environment colliders, and zombie hit
 * testing) with one frozen zombie. You shoot, the lab shows what the game's
 * hit logic decided, and you label what it should have been (H head, B body,
 * M miss). Labeled shots persist; "Save to test set" merges them into the
 * Playwright eval's fixture (e2e/fixtures/zombie-hit-lab-shots.json, via a
 * dev-server endpoint in vite.config.ts); "Re-score all" replays every saved
 * shot against the current hit logic, so a hitbox change can be measured.
 *
 * The canvas is pinned to 16:9, so a shot's NDC maps to the same world ray on
 * every replay whatever the window size (lane layout and FOV both follow the
 * aspect). Once the zombie for the current setup is posed and hittable, the
 * view is marked `data-zombie-ready="true"`: what the e2e eval waits on.
 */

const ASPECT = 16 / 9
const CARRIER_ID = 'lab-zombie'
const OUTCOME_COLOR: Readonly<Record<Outcome, string>> = { head: '#FF2D55', body: '#2D9CFF', miss: '#9AA0A6' }
const LANES = [0, 1, 2, 3] as const
const button: CSSProperties = { padding: '5px 9px', fontSize: 12, cursor: 'pointer' }

export interface ZombieHitLabDeps {
  /** The page URL's query string: the starting setup. */
  readonly search: string
  readonly storage: ShotStorage
  /** POSTs labeled shots to the eval fixture (dev server only). */
  readonly appendToTestSet: (shots: readonly LabShot[]) => Promise<AppendResult>
  /** Saves `text` as a downloaded file. */
  readonly download: (fileName: string, text: string) => void
  readonly keys: KeyPresses
  readonly clock: {
    readonly now: () => number
    readonly wait: (ms: number) => Promise<void>
    /** Runs `run` after the current event has finished propagating. */
    readonly defer: (run: () => void) => void
  }
  readonly createShotId: () => string
  /** Today as `YYYY-MM-DD`, for export file names. */
  readonly today: () => string
}

function setupKeyOf(config: LabConfig): string {
  return `${config.characterId}|${String(config.lane)}|${String(config.distance)}|${String(config.poseTime)}`
}

function Shooter({ setupKey, onShooter, onSettled }: { readonly setupKey: string; readonly onShooter: (shooter: LabShooter | null) => void; readonly onSettled: (key: string) => void }): null {
  useLabShooter(setupKey, onShooter, onSettled)
  return null
}

export function bindZombieHitLab({ search, storage, appendToTestSet, download, keys, clock, createShotId, today }: ZombieHitLabDeps): ComponentType {
  /** Waits until the scene has a hittable zombie for the new setup, stepping the render loop by hand so the pose applies even in a background tab, where requestAnimationFrame doesn't fire. */
  async function settleScene(hasZombie: () => boolean): Promise<void> {
    let steady = 0
    for (let i = 0; i < 200 && steady < SETTLED_FRAMES; i++) {
      await clock.wait(25)
      advance(clock.now())
      steady = hasZombie() ? steady + 1 : 0
    }
  }

  function ZombieHitLab(): ReactElement {
    const [config, setConfig] = useState<LabConfig>(() => labConfigFromSearch(search, SCIENTIST_ZOMBIE))
    const [shots, setShots] = useSavedShots(storage)
    const [saveStatus, setSaveStatus] = useState<string | null>(null)
    const [aimNdc, setAimNdc] = useState<{ readonly x: number; readonly y: number } | null>(null)
    const [recoilSignal, setRecoilSignal] = useState(0)
    const [rescoring, setRescoring] = useState(false)
    const [settledKey, setSettledKey] = useState<string | null>(null)
    const shooterRef = useRef<LabShooter | null>(null)
    const liveHitRef = useRef<Outcome | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const character = ZOMBIE_CHARACTER_REGISTRY.find((c) => c.id === config.characterId) ?? SCIENTIST_ZOMBIE
    const carrier: Carrier = {
      // Keyed on pose, so a pose change remounts the zombie and re-seeks its clip.
      id: `${CARRIER_ID}-${String(config.poseTime)}`,
      label: '?',
      correct: true,
      lane: config.lane,
      distance: config.distance,
      status: 'active',
      defeatedBy: null,
    }
    const setupKey = setupKeyOf(config)
    const pending = shots.find((s) => s.expected === null) ?? null
    const shotsHere = shots.filter((s) => sameConfig(s, config))
    const labeled = shots.filter((s) => s.expected !== null)
    const score = scoreShots(shots)

    function label(expected: Outcome): void {
      setShots((previous) => labelPending(previous, expected))
    }

    useKeyPresses(keys, (key) => {
      if (key === 'h') label('head')
      else if (key === 'b') label('body')
      else if (key === 'm') label('miss')
      else if (key === 'backspace' || key === 'z') setShots((previous) => previous.slice(0, -1))
    })

    function ndcOf(e: PointerEvent<HTMLDivElement>): { readonly x: number; readonly y: number } {
      return aimFromPointer(e.clientX, e.clientY, e.currentTarget.getBoundingClientRect())
    }

    function handleShoot(e: PointerEvent<HTMLDivElement>): void {
      const shooter = shooterRef.current
      if (e.button !== 0 || shooter === null) return
      const ndc = ndcOf(e)
      const recorded = shooter.shoot(ndc)
      const id = createShotId()
      setRecoilSignal((n) => n + 1)
      setShots((previous) => addShot(previous, { ...config, id, ndc, expected: null, recorded }))
      // R3F dispatches the same pointerdown to the scene's own handlers, before or after this one: read what they said once it has propagated.
      clock.defer(() => {
        const live = liveHitRef.current ?? 'miss'
        liveHitRef.current = null
        if (live !== recorded) console.warn(`[ZombieHitLab] game event path said ${live}, lab raycast said ${recorded}`)
        setShots((previous) => previous.map((s) => (s.id === id ? { ...s, live } : s)))
      })
    }

    async function rescoreAll(): Promise<void> {
      setRescoring(true)
      const original = config
      const results = new Map<string, Outcome>()
      for (const setup of distinctConfigs(shots)) {
        setConfig(setup)
        await settleScene(() => shooterRef.current?.hasZombie() ?? false)
        const shooter = shooterRef.current
        if (shooter === null) continue
        for (const s of shots) if (sameConfig(s, setup)) results.set(s.id, shooter.shoot(s.ndc))
      }
      setShots((previous) =>
        previous.map((s) => {
          const rescored = results.get(s.id)
          return rescored === undefined ? s : { ...s, rescored }
        }),
      )
      setConfig(original)
      setRescoring(false)
    }

    async function saveToTestSet(): Promise<void> {
      setSaveStatus('Saving…')
      try {
        const { added, total } = await appendToTestSet(labeled)
        setSaveStatus(`Added ${String(added)} new shot${added === 1 ? '' : 's'} — test set now has ${String(total)}`)
      } catch (error) {
        setSaveStatus(`Save failed: ${errorMessage(error)}`)
      }
    }

    function importFile(file: File): void {
      void file.text().then((text) => {
        setShots(parseShots(text))
      })
    }

    return (
      <div style={{ width: '100%', height: '100vh', display: 'flex', flexDirection: 'column', background: '#111', color: '#EEE', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ padding: 8, display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center', fontSize: 12 }}>
          <span role="group" aria-label="Character" style={{ display: 'flex', gap: 4 }}>
            {ZOMBIE_CHARACTER_REGISTRY.filter((c) => c.enabled).map((c) => (
              <button
                key={c.id}
                type="button"
                aria-pressed={c.id === config.characterId}
                style={{ ...button, fontWeight: c.id === config.characterId ? 700 : 400 }}
                onClick={() => {
                  setConfig({ ...config, characterId: c.id })
                }}
              >
                {c.displayName.replace(' Zombie', '')}
              </button>
            ))}
          </span>
          <label>
            Lane{' '}
            <select
              value={config.lane}
              onChange={(e) => {
                setConfig({ ...config, lane: Number(e.target.value) })
              }}
            >
              {LANES.map((l) => (
                <option key={l} value={l}>
                  {l + 1}
                </option>
              ))}
            </select>
          </label>
          <label>
            Distance {config.distance.toFixed(2)}{' '}
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={config.distance}
              onChange={(e) => {
                setConfig({ ...config, distance: Number(e.target.value) })
              }}
            />
          </label>
          <label>
            Pose {config.poseTime.toFixed(2)}s{' '}
            <input
              type="range"
              min={0}
              max={2}
              step={0.1}
              value={config.poseTime}
              onChange={(e) => {
                setConfig({ ...config, poseTime: Number(e.target.value) })
              }}
            />
          </label>
        </div>

        <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div
            role="region"
            aria-label="Shooting range"
            data-zombie-ready={settledKey === setupKey}
            onPointerMove={(e) => {
              setAimNdc(ndcOf(e))
            }}
            onPointerLeave={() => {
              setAimNdc(null)
            }}
            onPointerDown={handleShoot}
            style={{ position: 'relative', aspectRatio: String(ASPECT), width: `min(100%, calc((100vh - 130px) * ${String(ASPECT)}))`, cursor: 'none', overflow: 'hidden' }}
          >
            <Canvas shadows>
              <AsyncBoundary
                loading={null}
                failed={() => null}
                onError={(error) => {
                  console.warn('[ZombieHitLab] the scene failed to load', error)
                }}
              >
                <OutbreakScene
                  carriers={[carrier]}
                  charactersByLane={[character, character, character, character]}
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
                  onReloadStart={() => undefined}
                  fixedPhaseOffsetSeconds={config.poseTime}
                />
                <Shooter
                  setupKey={setupKey}
                  onShooter={(shooter) => {
                    shooterRef.current = shooter
                  }}
                  onSettled={setSettledKey}
                />
              </AsyncBoundary>
            </Canvas>

            {/* Shot markers for this setup: fill is what the game decided; ring is green if it agrees (hit vs. miss) with your label, red if not, white while unlabeled. */}
            {shotsHere.map((s) => {
              const outcome = currentOutcome(s)
              const ring = s.expected === null ? '#FFFFFF' : isHit(s.expected) === isHit(outcome) ? '#22C55E' : '#EF4444'
              return (
                <div
                  key={s.id}
                  title={`game: ${outcome} / you: ${s.expected ?? '?'}`}
                  style={{
                    position: 'absolute',
                    left: `${String(((s.ndc.x + 1) / 2) * 100)}%`,
                    top: `${String(((1 - s.ndc.y) / 2) * 100)}%`,
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

            {/* The game's 36px ring, plus a centre dot on the exact pixel the ray goes through. */}
            {aimNdc !== null && (
              <div
                style={{
                  position: 'absolute',
                  left: `${String(((aimNdc.x + 1) / 2) * 100)}%`,
                  top: `${String(((1 - aimNdc.y) / 2) * 100)}%`,
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

            {pending !== null && (
              <div
                role="group"
                aria-label="Label the shot"
                style={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.8)', padding: '8px 12px', borderRadius: 10, fontSize: 14, display: 'flex', gap: 8, alignItems: 'center' }}
                onPointerDown={(e) => {
                  e.stopPropagation()
                }}
              >
                Game said <b style={{ color: OUTCOME_COLOR[pending.recorded] }}>{pending.recorded.toUpperCase()}</b> — it should be:
                <button
                  type="button"
                  style={button}
                  onClick={() => {
                    label('head')
                  }}
                >
                  <u>H</u>ead
                </button>
                <button
                  type="button"
                  style={button}
                  onClick={() => {
                    label('body')
                  }}
                >
                  <u>B</u>ody
                </button>
                <button
                  type="button"
                  style={button}
                  onClick={() => {
                    label('miss')
                  }}
                >
                  <u>M</u>iss
                </button>
              </div>
            )}
          </div>
        </div>

        <div style={{ padding: 8, display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center', fontSize: 12 }}>
          <span role="status">
            Labeled <b>{score.labeled}</b> · hit/miss agreement <b>{percentOf(score.hitMissAgree, score.labeled)}</b> · should-hit-but-missed <b style={{ color: '#EF4444' }}>{score.falseMisses}</b> · should-miss-but-hit{' '}
            <b>{score.falseHits}</b> · wrong zone <b>{score.zoneWrong}</b>
          </span>
          <button type="button" style={button} disabled={rescoring || shots.length === 0} onClick={() => void rescoreAll()}>
            {rescoring ? 'Re-scoring…' : 'Re-score all'}
          </button>
          <button type="button" style={button} onClick={() => void saveToTestSet()} disabled={labeled.length === 0}>
            Save to test set
          </button>
          {saveStatus !== null && <span>{saveStatus}</span>}
          <button
            type="button"
            style={button}
            onClick={() => {
              download(`zombie-hit-lab-${today()}.json`, exportDocument(shots, ASPECT))
            }}
            disabled={labeled.length === 0}
          >
            Download JSON
          </button>
          <button
            type="button"
            style={button}
            onClick={() => {
              fileInputRef.current?.click()
            }}
          >
            Import JSON
          </button>
          <input
            ref={fileInputRef}
            type="file"
            aria-label="Import shots"
            accept="application/json"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) importFile(file)
            }}
          />
          <button
            type="button"
            style={button}
            onClick={() => {
              setShots((previous) => previous.slice(0, -1))
            }}
            disabled={shots.length === 0}
          >
            Undo (Z)
          </button>
          <button
            type="button"
            style={button}
            onClick={() => {
              setShots([])
            }}
            disabled={shots.length === 0}
          >
            Clear all
          </button>
        </div>
      </div>
    )
  }
  return ZombieHitLab
}
