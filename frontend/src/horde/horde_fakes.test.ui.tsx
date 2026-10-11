import type { ComponentType, ReactElement } from 'react'
import type { ArmoryItemRecord, ArmoryStateRecord } from '@app/api/armory_schema.pure.lib.ts'
import type { AttemptBody, ItemRecord } from '@app/api/practice_schema.pure.lib.ts'
import type { MotionPreference } from '@app/motion/use_prefers_reduced_motion.pure.hook.ts'
import { NO_MOTION_PREFERENCE, recordingAudio, virtualScheduler, type VirtualScheduler } from '@app/outbreak/arena_fakes.test.ui.tsx'
import type { ArenaScheduler } from '@app/outbreak/zombie_arena_state.pure.lib.ts'
import { ZOMBIE_CHARACTER_REGISTRY } from '@app/zombies/character_definitions.pure.lib.ts'
import type { HordeViewportProps } from './horde_viewport.pure.ui.tsx'
import { bindZombieHorde, type ZombieHordeProps } from './zombie_horde.effect.ui.tsx'

/**
 * Fakes for Zombie Horde's tests and stories: arithmetic items, an in-memory
 * armory server with the backend's catalog and rules, a recording audio
 * system, the arena's virtual clock, and a plain-DOM stand-in for the 3D view
 * whose buttons report the same shots the real raycaster does.
 */

export const FACTS = [
  { answer: 7, options: [6, 7, 8, 5] },
  { answer: 9, options: [9, 10, 8, 11] },
  { answer: 6, options: [5, 6, 7, 4] },
  { answer: 12, options: [12, 13, 11, 10] },
  { answer: 4, options: [3, 4, 5, 6] },
] as const

export function hordeItem(i: number, approachMs: number): ItemRecord {
  const fact = FACTS[i % FACTS.length] ?? FACTS[0]
  return {
    item_id: `horde-${String(i)}`,
    game_id: 'zombie_horde',
    level: 1,
    variant_id: null,
    payload: { left: 3, operator: '+', right: fact.answer - 3, answer: fact.answer, options: [...fact.options], approach_ms: approachMs },
  }
}

export function rightAnswer(i: number): number {
  return (FACTS[i % FACTS.length] ?? FACTS[0]).answer
}

export function wrongAnswer(i: number): number {
  const fact = FACTS[i % FACTS.length] ?? FACTS[0]
  return fact.options.find((value) => value !== fact.answer) ?? 0
}

/** The backend's catalog (app/armory/armory_reducers_pure.py), for the fake server. */
export const CATALOG: readonly ArmoryItemRecord[] = [
  { id: 'starter_blaster', kind: 'weapon', name: 'Starter Blaster', description: 'Your trusty blaster.', price: 0, quantity: 1, consumable: false, requires: null },
  { id: 'rapid_blaster', kind: 'weapon', name: 'Rapid Blaster', description: 'Reloads twice as fast and hits a little harder.', price: 250, quantity: 1, consumable: false, requires: 'starter_blaster' },
  { id: 'mega_blaster', kind: 'weapon', name: 'Mega Blaster', description: 'Huge hits and a lightning-fast reload.', price: 600, quantity: 1, consumable: false, requires: 'rapid_blaster' },
  { id: 'standard_rounds', kind: 'bullet', name: 'Standard Rounds', description: 'Never run out. Headshots hit hardest; leg shots knock zombies down.', price: 0, quantity: 1, consumable: false, requires: null },
  { id: 'armor_piercing', kind: 'bullet', name: 'Armor-Piercing Rounds', description: '25 rounds. Body and leg shots hit much harder.', price: 60, quantity: 25, consumable: true, requires: null },
  { id: 'explosive_rounds', kind: 'bullet', name: 'Explosive Rounds', description: '25 rounds. Every shot hits harder, wherever it lands.', price: 120, quantity: 25, consumable: true, requires: null },
  { id: 'grenade_pack', kind: 'grenade', name: 'Grenade Pack', description: 'Three grenades. A grenade only goes off near the zombie with the right answer.', price: 80, quantity: 3, consumable: true, requires: null },
]

export interface RoundReport {
  readonly points: number
  readonly grenades_used: number
  readonly rounds_used?: Readonly<Record<string, number>>
}

export interface FakeArmory {
  readonly load: (profileId: number) => Promise<ArmoryStateRecord>
  readonly purchase: (profileId: number, itemId: string) => Promise<ArmoryStateRecord>
  readonly recordRound: (profileId: number, round: RoundReport) => Promise<ArmoryStateRecord>
  readonly state: () => ArmoryStateRecord
  readonly rounds: readonly RoundReport[]
}

/** The armory server in memory: the same refusals as the backend (unknown, owned, locked, too expensive). */
export function fakeArmory({ balance = 0, owned = [], grenades = 1, ammo = {} }: { readonly balance?: number; readonly owned?: readonly string[]; readonly grenades?: number; readonly ammo?: Readonly<Record<string, number>> } = {}): FakeArmory {
  let points = balance
  let spent = 0
  let left = grenades
  const bought = new Set(owned)
  const rounds: RoundReport[] = []
  const shots = new Map<string, number>([['armor_piercing', ammo['armor_piercing'] ?? 0], ['explosive_rounds', ammo['explosive_rounds'] ?? 0]])
  const state = (): ArmoryStateRecord => ({
    profile_id: 1,
    balance: points - spent,
    earned: points,
    spent,
    owned: CATALOG.filter((item) => !item.consumable && (item.price === 0 || bought.has(item.id))).map((item) => item.id),
    grenades: left,
    ammo: Object.fromEntries(shots),
    catalog: CATALOG,
  })
  return {
    state,
    rounds,
    load: () => Promise.resolve(state()),
    purchase: (_profileId, itemId) => {
      const item = CATALOG.find((candidate) => candidate.id === itemId)
      const now = state()
      if (item === undefined) return Promise.reject(new Error(`the armory has no item '${itemId}'`))
      if (!item.consumable && now.owned.includes(item.id)) return Promise.reject(new Error(`'${itemId}' is already owned`))
      if (item.requires !== null && !now.owned.includes(item.requires)) return Promise.reject(new Error(`'${itemId}' needs '${item.requires}' first`))
      if (item.price > now.balance) return Promise.reject(new Error(`'${itemId}' costs ${String(item.price)} points; the balance is ${String(now.balance)}`))
      spent += item.price
      if (item.kind === 'grenade') left += item.quantity
      else if (item.consumable) shots.set(item.id, (shots.get(item.id) ?? 0) + item.quantity)
      else bought.add(item.id)
      return Promise.resolve(state())
    },
    recordRound: (_profileId, round) => {
      rounds.push(round)
      points += round.points
      left = Math.max(0, left - round.grenades_used)
      for (const [id, used] of Object.entries(round.rounds_used ?? {})) shots.set(id, Math.max(0, (shots.get(id) ?? 0) - used))
      return Promise.resolve(state())
    },
  }
}

/** The 3D view as buttons: `head 7`, `body 7`, `leg 7`, and `grenade at 7` per zombie with an answer, plus `miss` and `floor grenade`. */
export function FakeHordeViewport({ zombies, answers, grenadeArmed, onShot, onGrenade }: HordeViewportProps): ReactElement {
  return (
    <div>
      <button
        type="button"
        onClick={() => {
          onShot(null)
        }}
      >
        miss
      </button>
      {grenadeArmed && <span>armed</span>}
      {zombies.map((zombie, i) => {
        const answer = answers[i]
        if (answer === null || answer === undefined) return null
        return (
          <span key={zombie.id}>
            {(['head', 'body', 'leg'] as const).map((zone) => (
              <button
                key={zone}
                type="button"
                onClick={() => {
                  onShot({ zombieId: zombie.id, zone })
                }}
              >{`${zone} ${answer}`}</button>
            ))}
            <button
              type="button"
              onClick={() => {
                onGrenade({ x: zombie.x, depth: zombie.depth })
              }}
            >{`grenade at ${answer}`}</button>
          </span>
        )
      })}
    </div>
  )
}

export interface HordeHarness {
  readonly ZombieHorde: ComponentType<ZombieHordeProps>
  readonly scheduler: VirtualScheduler
  readonly audio: ReturnType<typeof recordingAudio>
  readonly attempts: readonly AttemptBody[]
  readonly armory: FakeArmory
}

export interface HordeHarnessOptions {
  /** The items' approach_ms; zombies cross the field in five times this. */
  readonly approachMs?: number
  readonly armory?: FakeArmory
  readonly motion?: MotionPreference
  readonly Viewport?: ComponentType<HordeViewportProps>
  readonly nextItemFails?: string
  /** Real time instead of the virtual clock (stories, in a real browser). */
  readonly scheduler?: ArenaScheduler
}

/** Zombie Horde bound over fakes: items cycle through FACTS, attempts are recorded, the roster is the first four characters, the seed is fixed. */
export function hordeHarness({ approachMs = 60_000, armory = fakeArmory(), motion = NO_MOTION_PREFERENCE, Viewport = FakeHordeViewport, nextItemFails, scheduler: realScheduler }: HordeHarnessOptions = {}): HordeHarness {
  const scheduler = virtualScheduler()
  const audio = recordingAudio()
  const attempts: AttemptBody[] = []
  let items = 0
  let sessions = 0
  const ZombieHorde = bindZombieHorde({
    nextItem: () => (nextItemFails === undefined ? Promise.resolve(hordeItem(items++, approachMs)) : Promise.reject(new Error(nextItemFails))),
    recordAttempt: (attempt) => {
      attempts.push(attempt)
      return Promise.resolve()
    },
    bankRound: armory.recordRound,
    armory: { load: armory.load, purchase: armory.purchase },
    scheduler: realScheduler ?? scheduler,
    audio,
    pickRoster: () => ZOMBIE_CHARACTER_REGISTRY.slice(0, 4),
    createSessionId: () => `session-${String(++sessions)}`,
    newSeed: () => 1234,
    reportError: () => undefined,
    Viewport,
    motion,
    speakText: () => undefined,
  })
  return { ZombieHorde, scheduler, audio, attempts, armory }
}
