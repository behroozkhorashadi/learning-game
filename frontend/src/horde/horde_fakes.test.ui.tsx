import type { ComponentType, ReactElement } from 'react'
import type { ArmoryItemRecord, ArmoryLooksRecord, ArmoryLooksStateRecord, ArmoryStateRecord, ArtPieceRecord, ArtResultRecord } from '@app/api/armory_schema.pure.lib.ts'
import type { components } from '@app/api/openapi_schema.pure.lib.ts'
import { fakeCamera, picture } from '@app/profiles/profile_photo_fixtures.test.lib.ts'
import type { AttemptBody, ItemRecord } from '@app/api/practice_schema.pure.lib.ts'
import type { MotionPreference } from '@app/motion/use_prefers_reduced_motion.pure.hook.ts'
import { NO_MOTION_PREFERENCE, recordingAudio, virtualScheduler, type VirtualScheduler } from '@app/outbreak/arena_fakes.test.ui.tsx'
import type { ArenaScheduler } from '@app/outbreak/zombie_arena_state.pure.lib.ts'
import { ZOMBIE_CHARACTER_REGISTRY } from '@app/zombies/character_definitions.pure.lib.ts'
import { bindArtStudio } from './art_studio.effect.ui.tsx'
import type { Difficulty } from './horde_difficulty.pure.lib.ts'
import { DEFAULT_LOOKS } from './horde_looks.pure.lib.ts'
import type { Recording } from './horde_recording.pure.lib.ts'
import type { HordeViewportProps } from './horde_viewport.pure.ui.tsx'
import { bindStyleStudio } from './style_studio.effect.ui.tsx'
import { bindZombieHorde, type ZombieHordeProps } from './zombie_horde.effect.ui.tsx'
import { MAX_STEP_MS } from './use_horde_round.pure.hook.ts'

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
  { id: 'mega_blaster', kind: 'weapon', name: 'Mega Blaster', description: 'Huge hits and a lightning-fast reload. With Explosive Rounds, one headshot does it.', price: 600, quantity: 1, consumable: false, requires: 'rapid_blaster' },
  { id: 'standard_rounds', kind: 'bullet', name: 'Standard Rounds', description: 'Never run out. Headshots hit hardest; leg shots knock zombies down.', price: 0, quantity: 1, consumable: false, requires: null },
  { id: 'armor_piercing', kind: 'bullet', name: 'Armor-Piercing Rounds', description: '25 rounds. Body and leg shots hit much harder.', price: 60, quantity: 25, consumable: true, requires: null },
  { id: 'explosive_rounds', kind: 'bullet', name: 'Explosive Rounds', description: '25 rounds. Every shot hits harder and blows up where it lands.', price: 120, quantity: 25, consumable: true, requires: null },
  { id: 'art_studio', kind: 'art', name: 'Art Studio', description: 'Snap a selfie and turn it into a one-of-a-kind piece of art for your gallery.', price: 300, quantity: 1, consumable: true, requires: null },
  { id: 'grenade_pack', kind: 'grenade', name: 'Grenade Pack', description: 'Three grenades. Defeats the zombie with the right answer and knocks down every zombie near it.', price: 150, quantity: 3, consumable: true, requires: null },
  { id: 'reflect_gem', kind: 'gem', name: 'Reflect Gem', description: 'Snaps onto your armor. Bounces 2 thrown things back at the zombie that threw them.', price: 60, quantity: 2, consumable: true, requires: null },
  { id: 'block_gem', kind: 'gem', name: 'Block Gem', description: 'Snaps onto your armor. Twice, a zombie that reaches you only does half a heart, then flies back.', price: 80, quantity: 2, consumable: true, requires: null },
  { id: 'mega_gem', kind: 'gem', name: 'Mega Gem', description: 'Does both, twice: reflects a throw or blocks a hit, whichever comes first.', price: 150, quantity: 2, consumable: true, requires: null },
  { id: 'heal_gem', kind: 'gem', name: 'Heal Gem', description: 'Snaps onto your armor. Twice, 5 right answers in a row win back half a heart.', price: 100, quantity: 2, consumable: true, requires: null },
  { id: 'thorns_plating', kind: 'upgrade', name: 'Thorns Plating', description: 'Spikes on your armor. Every zombie you block gets hurt too. Yours for good.', price: 250, quantity: 1, consumable: false, requires: null },
  { id: 'steel_suit', kind: 'skin', name: 'Steel Suit', description: 'Your trusty armor.', price: 0, quantity: 1, consumable: false, requires: null },
  { id: 'jungle_camo', kind: 'skin', name: 'Jungle Camo', description: 'Green and sneaky. Just for looks.', price: 100, quantity: 1, consumable: false, requires: null },
  { id: 'galaxy_suit', kind: 'skin', name: 'Galaxy Suit', description: 'Deep purple with a starry glow. Just for looks.', price: 200, quantity: 1, consumable: false, requires: null },
  { id: 'gold_suit', kind: 'skin', name: 'Gold Suit', description: 'Shiny gold, for true zombie champions. Just for looks.', price: 400, quantity: 1, consumable: false, requires: null },
  { id: 'suit_paint', kind: 'style', name: 'Suit Paint Studio', description: 'Paint your armor any colour you like: matte, shiny, or glowing.', price: 150, quantity: 1, consumable: false, requires: null },
  { id: 'blaster_paint', kind: 'style', name: 'Blaster Paint', description: 'Paint your blaster any colour you like.', price: 150, quantity: 1, consumable: false, requires: null },
  { id: 'emblem_maker', kind: 'style', name: 'Emblem Maker', description: 'Design your own badge for your arm or blaster: a symbol, or one of your art pieces.', price: 120, quantity: 1, consumable: false, requires: null },
  { id: 'pathfinder_frame', kind: 'style', name: 'Pathfinder Backdrop', description: 'Hang one of your art pieces behind the Pathfinder board.', price: 100, quantity: 1, consumable: false, requires: null },
  { id: 'horde_billboard', kind: 'style', name: 'Horde Billboard', description: 'Hang one of your art pieces on a giant billboard in Zombie Horde.', price: 100, quantity: 1, consumable: false, requires: null },
]

export interface RoundReport {
  readonly points: number
  readonly grenades_used: number
  readonly rounds_used?: Readonly<Record<string, number>>
  readonly gems_used?: Readonly<Record<string, number>>
  readonly survived_ms?: number
  readonly difficulty?: Difficulty
}

export interface FakeArmory {
  readonly load: (profileId: number) => Promise<ArmoryStateRecord>
  readonly purchase: (profileId: number, itemId: string) => Promise<ArmoryStateRecord>
  readonly recordRound: (profileId: number, round: RoundReport) => Promise<ArmoryStateRecord>
  readonly state: () => ArmoryStateRecord
  readonly rounds: readonly RoundReport[]
  readonly gallery: (profileId: number) => Promise<readonly ArtPieceRecord[]>
  readonly createArt: (profileId: number, request: components['schemas']['ArtCreate']) => Promise<ArtResultRecord>
  /** The prompts' inputs the fake AI was sent. */
  readonly artRequests: readonly components['schemas']['ArtCreate'][]
  readonly looks: (profileId: number) => Promise<ArmoryLooksStateRecord>
  readonly saveLooks: (profileId: number, looks: ArmoryLooksRecord) => Promise<ArmoryLooksStateRecord>
  /** The looks as last saved. */
  readonly savedLooks: () => ArmoryLooksRecord
}

/** The armory server in memory: the same refusals as the backend (unknown, owned, locked, too expensive). */
export function fakeArmory({ balance = 0, owned = [], grenades = 1, ammo = {}, gems = {}, artAvailable = true, bestMs = {}, art: startingArt = [], looks: startingLooks = DEFAULT_LOOKS }: { readonly balance?: number; readonly owned?: readonly string[]; readonly grenades?: number; readonly ammo?: Readonly<Record<string, number>>; readonly gems?: Readonly<Record<string, number>>; readonly artAvailable?: boolean; readonly bestMs?: Partial<Readonly<Record<Difficulty, number>>>; readonly art?: readonly ArtPieceRecord[]; readonly looks?: ArmoryLooksRecord } = {}): FakeArmory {
  const art: ArtPieceRecord[] = [...startingArt]
  let savedLooks = startingLooks
  const artRequests: components['schemas']['ArtCreate'][] = []
  let points = balance
  let spent = 0
  let left = grenades
  const best: Record<Difficulty, number> = { easy: 0, medium: 0, hard: 0, insane: 0, ...bestMs }
  const bought = new Set(owned)
  const rounds: RoundReport[] = []
  const shots = new Map<string, number>([['armor_piercing', ammo['armor_piercing'] ?? 0], ['explosive_rounds', ammo['explosive_rounds'] ?? 0]])
  const charges = new Map<string, number>(CATALOG.filter((item) => item.kind === 'gem').map((item) => [item.id, gems[item.id] ?? 0]))
  const looksState = (looks: ArmoryLooksRecord): ArmoryLooksStateRecord => ({
    looks,
    pictures: Object.fromEntries(art.filter((piece) => [looks.emblem?.art_id, looks.hung.pathfinder, looks.hung.horde].includes(piece.id)).map((piece) => [piece.id, piece.image_url])),
  })
  const state = (): ArmoryStateRecord => ({
    profile_id: 1,
    balance: points - spent,
    earned: points,
    spent,
    owned: CATALOG.filter((item) => !item.consumable && (item.price === 0 || bought.has(item.id))).map((item) => item.id),
    grenades: left,
    ammo: Object.fromEntries(shots),
    gems: Object.fromEntries(charges),
    best_survived_ms: { ...best },
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
      else if (item.kind === 'gem') charges.set(item.id, (charges.get(item.id) ?? 0) + item.quantity)
      else if (item.consumable) shots.set(item.id, (shots.get(item.id) ?? 0) + item.quantity)
      else bought.add(item.id)
      return Promise.resolve(state())
    },
    artRequests,
    gallery: () => Promise.resolve([...art].reverse()),
    createArt: (_profileId, request) => {
      const price = CATALOG.find((item) => item.kind === 'art')?.price ?? 0
      if (state().balance < price) return Promise.reject(new Error(`'art_studio' costs ${String(price)} points; the balance is ${String(state().balance)}`))
      artRequests.push(request)
      if (!artAvailable) return Promise.reject(new Error("the art studio can't make art right now; no points were spent"))
      spent += price
      const piece: ArtPieceRecord = { id: `art-${String(art.length + 1)}`, profile_id: 1, image_url: picture(['#9D57FA', '#5BCC2D', '#F59E0B'][art.length % 3] ?? '#9D57FA'), style: request.style, idea: request.idea, created_at: '2026-10-11T12:00:00Z' }
      art.push(piece)
      return Promise.resolve({ piece, armory: state() })
    },
    savedLooks: () => savedLooks,
    looks: () => Promise.resolve(looksState(savedLooks)),
    saveLooks: (_profileId, looks) => {
      // The backend's checks (looks_reducers_pure): every look needs its unlock, and art must be in the gallery.
      const owned = state().owned
      const needs = [
        looks.skin_id,
        looks.suit_paint === null ? null : 'suit_paint',
        looks.blaster_color === null ? null : 'blaster_paint',
        looks.emblem === null ? null : 'emblem_maker',
        looks.hung.pathfinder === null ? null : 'pathfinder_frame',
        looks.hung.horde === null ? null : 'horde_billboard',
      ].find((id) => id !== null && !owned.includes(id))
      if (needs !== undefined && needs !== null) return Promise.reject(new Error(`that look needs '${needs}' first`))
      const missing = [looks.emblem?.art_id ?? null, looks.hung.pathfinder, looks.hung.horde].find((id) => id !== null && !art.some((piece) => piece.id === id))
      if (missing !== undefined && missing !== null) return Promise.reject(new Error(`there's no art piece '${missing}' in this gallery`))
      savedLooks = looks
      return Promise.resolve(looksState(looks))
    },
    recordRound: (_profileId, round) => {
      rounds.push(round)
      points += round.points
      left = Math.max(0, left - round.grenades_used)
      const difficulty = round.difficulty ?? 'medium'
      best[difficulty] = Math.max(best[difficulty], round.survived_ms ?? 0)
      for (const [id, used] of Object.entries(round.rounds_used ?? {})) shots.set(id, Math.max(0, (shots.get(id) ?? 0) - used))
      for (const [id, used] of Object.entries(round.gems_used ?? {})) charges.set(id, Math.max(0, (charges.get(id) ?? 0) - used))
      return Promise.resolve(state())
    },
  }
}

/** The 3D view as buttons: `head 7`, `body 7`, `leg 7`, and `grenade at 7` per zombie with an answer, plus `miss` and `floor grenade`. Names the blaster in hand and each hit effect showing. */
export function FakeHordeViewport({ zombies, answers, grenadeArmed, weapon, armTint, blasterTint, emblem, billboardUrl, impacts, impactStyle, onShot, onGrenade }: HordeViewportProps): ReactElement {
  return (
    <div>
      <span>{`holding the ${weapon.displayName}`}</span>
      <span>{armTint === null ? 'plain arms' : `arms tinted ${armTint.color}`}</span>
      <span>{blasterTint === null ? 'blaster as it comes' : `blaster painted ${blasterTint.color}`}</span>
      {emblem !== null && <span>{`emblem${emblem.onArm ? ' on the arm' : ''}${emblem.onBlaster ? ' on the blaster' : ''}`}</span>}
      {billboardUrl !== null && <span>{`billboard showing ${billboardUrl}`}</span>}
      {impacts.map((impact) => (
        <span key={impact.id}>{`${impact.special ? impactStyle : 'spark'} hit`}</span>
      ))}
      <button
        type="button"
        onClick={() => {
          onShot(null, null)
        }}
      >
        miss
      </button>
      <button
        type="button"
        onClick={() => {
          onShot(null, 'lockers-near-right')
        }}
      >
        blocked
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
                  onShot({ zombieId: zombie.id, zone }, null)
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
  /** Every recording saved, in order. */
  readonly replays: readonly Recording[]
  /** What the voice is reading right now, or null when it's quiet. */
  readonly nowReading: () => string | null
}

export interface HordeHarnessOptions {
  /** The items' approach_ms. */
  readonly approachMs?: number
  /** How long a zombie takes to cross the field; by default far longer than a round, so nothing reaches the player unless a test wants it to. */
  readonly travelMs?: number
  readonly armory?: FakeArmory
  readonly motion?: MotionPreference
  readonly Viewport?: ComponentType<HordeViewportProps>
  readonly nextItemFails?: string
  /** Real time instead of the virtual clock (stories, in a real browser). */
  readonly scheduler?: ArenaScheduler
}

/** Zombie Horde bound over fakes: items cycle through FACTS, attempts are recorded, the roster is the first four characters, the seed is fixed. */
export function hordeHarness({ approachMs = 60_000, travelMs = 600_000, armory = fakeArmory(), motion = NO_MOTION_PREFERENCE, Viewport = FakeHordeViewport, nextItemFails, scheduler: realScheduler }: HordeHarnessOptions = {}): HordeHarness {
  // Frames as long as the engine's own clamp: the same rules, a third of the renders.
  const scheduler = virtualScheduler({ frameMs: MAX_STEP_MS })
  const audio = recordingAudio()
  const attempts: AttemptBody[] = []
  const replays: Recording[] = []
  let items = 0
  let sessions = 0
  // A voice that keeps reading until it's stopped.
  let reading: { readonly text: string; readonly onEnd: (() => void) | undefined } | null = null
  const stopSpeaking = (): void => {
    const was = reading
    reading = null
    was?.onEnd?.()
  }
  const ZombieHorde = bindZombieHorde({
    nextItem: () => (nextItemFails === undefined ? Promise.resolve(hordeItem(items++, approachMs)) : Promise.reject(new Error(nextItemFails))),
    recordAttempt: (attempt) => {
      attempts.push(attempt)
      return Promise.resolve()
    },
    bankRound: armory.recordRound,
    armory: { load: armory.load, purchase: armory.purchase, looks: armory.looks, saveLooks: armory.saveLooks },
    scheduler: realScheduler ?? scheduler,
    audio,
    pickRoster: () => ZOMBIE_CHARACTER_REGISTRY.slice(0, 4),
    createSessionId: () => `session-${String(++sessions)}`,
    newSeed: () => 1234,
    reportError: () => undefined,
    saveReplay: (_profileId, recording) => {
      replays.push(recording)
      return Promise.resolve()
    },
    nowIso: () => '2026-10-11T12:00:00.000Z',
    travelMsFor: () => travelMs,
    Viewport,
    ArtStudio: bindArtStudio({ camera: fakeCamera(), gallery: armory.gallery, createArt: armory.createArt }),
    StyleStudio: bindStyleStudio({ looks: armory.looks, saveLooks: armory.saveLooks, gallery: armory.gallery, purchase: armory.purchase }),
    motion,
    readAloud: {
      speakText: (text, onEnd) => {
        stopSpeaking()
        reading = { text, onEnd }
      },
      stopSpeaking,
    },
  })
  return { ZombieHorde, scheduler, audio, attempts, armory, replays, nowReading: () => reading?.text ?? null }
}
